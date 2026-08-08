using System.Collections;
using System.Reflection;
using System.Text.RegularExpressions;
using Mutagen.Bethesda.Plugins.Records;
using Mutagen.Bethesda.Skyrim;

namespace SkyStore.CatalogBuilder;

/// <summary>
/// Reads only local game files during an offline catalog build. The generated bundle contains
/// normalized text metadata and web artwork paths, never NIFs, textures, or Bethesda archives.
/// </summary>
internal static class MutagenSkyrimCatalogReader
{
    private static readonly HashSet<string> InventoryTypes = new(StringComparer.Ordinal)
    {
        "Weapon", "Armor", "Ammunition", "Ingredient", "Ingestible", "Book", "Scroll", "SoulGem",
        "MiscItem", "Key", "Light", "Flora", "Furniture", "Tree", "AlchemyItem",
    };

    public static Task<CatalogBundle> BuildAsync(BuilderOptions options)
    {
        var plugins = WithImplicitMasters(ReadLoadOrder(options.LoadOrderPath), options.DataFolder);
        foreach (var plugin in plugins)
        {
            var pluginPath = Path.Combine(options.DataFolder, plugin);
            if (!File.Exists(pluginPath)) throw new FileNotFoundException($"Load-order plugin was not found under the supplied Data folder: {plugin}", pluginPath);
        }
        var checksum = StableIdentity.LoadOrderContentChecksum(options.DataFolder, plugins);
        var winningRecords = new Dictionary<string, RecordCandidate>(StringComparer.OrdinalIgnoreCase);
        var winningRecipes = new Dictionary<string, RecordCandidate>(StringComparer.OrdinalIgnoreCase);
        var professionGates = new ProfessionGateCatalog();

        foreach (var plugin in plugins)
        {
            var pluginPath = Path.Combine(options.DataFolder, plugin);
            // Mutagen reads the binary plugin. Replacing an earlier FormKey is the winning-override traversal.
            var mod = SkyrimMod.CreateFromBinaryOverlay(pluginPath, SkyrimRelease.SkyrimSE);
            foreach (var record in mod.EnumerateMajorRecords())
            {
                var type = RecordType(record);
                var formKey = ReadProperty(record, "FormKey")?.ToString();
                var formId = LocalFormId(record);
                if (string.IsNullOrWhiteSpace(formKey) || string.IsNullOrWhiteSpace(formId)) continue;
                // FormKey includes the record's origin plugin. Local IDs alone can collide between plugins.
                var candidate = new RecordCandidate(OriginPlugin(formKey) ?? plugin, plugin, formId, type, record);
                professionGates.Add(formKey, ReadString(record, "EditorID"), ReadTranslatedString(record, "Name"), type);
                if (InventoryTypes.Contains(type)) winningRecords[formKey] = candidate;
                if (type == "ConstructibleObject") winningRecipes[formKey] = candidate;
            }
        }

        var artwork = ArtworkManifest.Load(options.ArtworkManifestPath);
        var workbenchOverrides = SkyPatcherWorkbenchOverrides.Load(options.DataFolder);
        var items = winningRecords.Values
            .Select(candidate => ToItem(candidate, artwork))
            .OrderBy(item => item.Category, StringComparer.Ordinal)
            .ThenBy(item => item.Name, StringComparer.Ordinal)
            .ThenBy(item => item.StableKey, StringComparer.Ordinal)
            .ToList();
        var itemStableKeys = winningRecords.ToDictionary(
            pair => pair.Key,
            pair => StableItemKey(pair.Value.IdentityPlugin, pair.Value.FormId),
            StringComparer.OrdinalIgnoreCase);
        var recipes = winningRecipes.Values
            .Select(candidate => ToRecipe(candidate, itemStableKeys, workbenchOverrides, professionGates))
            .OrderBy(recipe => recipe.StableKey, StringComparer.Ordinal)
            .ToList();

        var catalog = new CatalogBundle(
            "1",
            StableIdentity.CatalogVersion(checksum),
            BuildTimestamp(),
            // Record the logical source folder without leaking an operator's absolute machine path.
            new CatalogSource(
                "Skyrim",
                options.Release.ToUpperInvariant(),
                Path.GetFileName(Path.TrimEndingDirectorySeparator(options.DataFolder)),
                checksum),
            items,
            recipes);
        return Task.FromResult(catalog);
    }

    private static DateTimeOffset BuildTimestamp()
    {
        var epoch = Environment.GetEnvironmentVariable("SOURCE_DATE_EPOCH");
        return long.TryParse(epoch, out var seconds)
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : DateTimeOffset.UtcNow;
    }

    private static CatalogItem ToItem(RecordCandidate candidate, IReadOnlyDictionary<string, string> artwork)
    {
        var editorId = ReadString(candidate.Record, "EditorID");
        var name = ReadTranslatedString(candidate.Record, "Name") ?? editorId ?? $"Unresolved {candidate.FormId}";
        var category = CommerceCategory.For(candidate.RecordType, name, editorId);
        var stableKey = StableItemKey(candidate.IdentityPlugin, candidate.FormId);
        var fallback = CommerceCategory.FallbackIcon(category, name, editorId);
        var modelPath = ReadModelPath(candidate.Record);
        var rendered = artwork.GetValueOrDefault(stableKey);
        var metadata = ExtractMetadata(candidate.Record, candidate.RecordType).ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.Ordinal);
        metadata["winningSourcePlugin"] = candidate.WinningPlugin;

        return new CatalogItem(
            StableIdentity.ItemId(candidate.IdentityPlugin, candidate.FormId),
            stableKey,
            name,
            editorId,
            candidate.IdentityPlugin,
            candidate.RecordType,
            candidate.FormId,
            category,
            ReadDecimal(candidate.Record, "Value"),
            ReadFloat(candidate.Record, "Weight"),
            new CatalogArtwork(rendered is null ? ArtworkStatus.Unresolved : ArtworkStatus.Rendered, fallback, modelPath, rendered),
            BuildAliases(name, editorId),
            metadata);
    }

    private static CatalogRecipe ToRecipe(RecordCandidate candidate, IReadOnlyDictionary<string, string> itemStableKeys, IReadOnlyList<WorkbenchOverride> workbenchOverrides, ProfessionGateCatalog professionGates)
    {
        var outputFormKey = FormKeyText(ReadProperty(candidate.Record, "CreatedObject"));
        var outputStableKey = outputFormKey is not null && itemStableKeys.TryGetValue(outputFormKey, out var resolvedOutput) ? resolvedOutput : null;
        var unresolved = new List<RecipeMappingIssue>();
        if (outputStableKey is null) unresolved.Add(new RecipeMappingIssue("output", outputFormKey, "The recipe output is not an inventory-capable catalog item in this load order."));
        var ingredients = new List<CatalogRecipeIngredient>();
        if (ReadProperty(candidate.Record, "Items") is IEnumerable entries)
        {
            foreach (var entry in entries.Cast<object?>().Where(entry => entry is not null))
            {
                var sourceFormKey = entry is IContainerEntryGetter containerEntry
                    ? containerEntry.Item.Item.FormKey.ToString()
                    : FormKeyText(ReadProperty(entry!, "Item"));
                var quantity = entry is IContainerEntryGetter typedEntry
                    ? Math.Max(1, typedEntry.Item.Count)
                    : ReadPositiveInt(ReadProperty(entry!, "Data") ?? entry!, "Count") ?? 1;
                var ingredientStableKey = sourceFormKey is not null && itemStableKeys.TryGetValue(sourceFormKey, out var resolvedIngredient) ? resolvedIngredient : null;
                if (ingredientStableKey is null) unresolved.Add(new RecipeMappingIssue("ingredient", sourceFormKey, "The ingredient reference is not an inventory-capable catalog item in this load order."));
                ingredients.Add(new CatalogRecipeIngredient(ingredientStableKey, sourceFormKey ?? "unresolved", quantity));
            }
        }
        else
        {
            unresolved.Add(new RecipeMappingIssue("ingredients", null, "The COBJ record exposed no readable ingredient entries."));
        }

        var editorId = ReadString(candidate.Record, "EditorID");
        var matchingOverrides = string.IsNullOrWhiteSpace(editorId) ? [] : workbenchOverrides.Where(rule => editorId.Contains(rule.EditorIdContains, StringComparison.OrdinalIgnoreCase)).ToArray();
        var distinctWorkbenches = matchingOverrides.Select(rule => rule.WorkbenchKey ?? "<null>").Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        var workbench = FormKeyText(ReadProperty(candidate.Record, "WorkbenchKeyword"));
        if (distinctWorkbenches.Length == 1) workbench = matchingOverrides[0].WorkbenchKey;
        if (distinctWorkbenches.Length > 1) unresolved.Add(new RecipeMappingIssue("workbench", null, "Multiple SkyPatcher workbench rules matched this recipe with different values; the plugin value was retained."));
        var sources = new List<string> { $"plugin:{candidate.WinningPlugin}" };
        sources.AddRange(matchingOverrides.Select(rule => $"sky-patcher:{rule.Source}").Distinct(StringComparer.Ordinal));
        var conditions = ReadConditions(candidate.Record, professionGates, out var professionGate);
        var inferred = InferProfession(editorId, workbench, candidate, professionGate);

        return new CatalogRecipe(
            StableIdentity.RecipeId(candidate.IdentityPlugin, candidate.FormId),
            $"recipe:{candidate.IdentityPlugin.ToLowerInvariant()}:{candidate.FormId.ToLowerInvariant()}",
            candidate.IdentityPlugin,
            candidate.FormId,
            editorId,
            outputStableKey,
            ReadPositiveInt(candidate.Record, "CreatedObjectCount") ?? 1,
            ingredients,
            workbench,
            inferred?.Profession,
            inferred?.MasteryTier,
            null,
            conditions,
            unresolved,
            sources);
    }

    private static string StableItemKey(string plugin, string formId) => $"{plugin.ToLowerInvariant()}:{formId.ToLowerInvariant()}";

    private static string? FormKeyText(object? value)
    {
        if (value is null) return null;
        var formKey = ReadProperty(value, "FormKey")?.ToString()
            ?? value.GetType().GetField("FormKey", BindingFlags.Public | BindingFlags.Instance)?.GetValue(value)?.ToString()
            ?? value.ToString();
        return string.IsNullOrWhiteSpace(formKey) || formKey.Contains("Null", StringComparison.OrdinalIgnoreCase) ? null : formKey;
    }

    private static int? ReadPositiveInt(object source, string propertyName)
    {
        var value = ReadProperty(source, propertyName);
        if (value is null) return null;
        try
        {
            var parsed = Convert.ToInt32(value, System.Globalization.CultureInfo.InvariantCulture);
            return parsed > 0 ? parsed : null;
        }
        catch (InvalidCastException) { return null; }
        catch (FormatException) { return null; }
    }

    private static IReadOnlyList<string> ReadConditions(object record, ProfessionGateCatalog professionGates, out ProfessionGate? professionGate)
    {
        professionGate = null;
        if (ReadProperty(record, "Conditions") is not IEnumerable conditions) return [];
        var descriptions = new SortedSet<string>(StringComparer.Ordinal);
        var pendingAlternatives = new List<string>();
        var alternativeGroup = 0;
        foreach (var condition in conditions.Cast<object?>().Where(condition => condition is not null))
        {
            var references = FindConditionFormKeys(condition!).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            var gates = references.Select(reference => professionGates.TryGet(reference, out var gate) ? gate : null).Where(gate => gate is not null).Cast<ProfessionGate>().ToArray();
            var conditionDescriptions = new List<string>();
            if (gates.Length > 0)
            {
                professionGate ??= gates.OrderByDescending(gate => ProfessionGateCatalog.TierRank(gate.MasteryTier)).First();
                foreach (var gate in gates) conditionDescriptions.Add($"requires:profession:{gate.Profession}:{gate.MasteryTier}");
            }
            foreach (var reference in references.Where(reference => !professionGates.TryGet(reference, out _) && !IsIncidentalConditionReference(reference))) conditionDescriptions.Add(professionGates.Requirement(reference));
            if (conditionDescriptions.Count == 0)
            {
                var function = ReadProperty(ReadProperty(condition!, "Data") ?? condition!, "Function")?.ToString();
                conditionDescriptions.Add(string.IsNullOrWhiteSpace(function) ? "condition:unmapped" : $"condition:{function}");
            }

            var joinsNext = ReadProperty(condition!, "Flags")?.ToString()?.Split(',', StringSplitOptions.TrimEntries).Contains("OR", StringComparer.OrdinalIgnoreCase) == true;
            if (joinsNext || pendingAlternatives.Count > 0)
            {
                pendingAlternatives.AddRange(conditionDescriptions);
                if (joinsNext) continue;
                foreach (var description in pendingAlternatives.Distinct(StringComparer.Ordinal))
                {
                    descriptions.Add(description.StartsWith("requires:", StringComparison.Ordinal)
                        ? $"requires:any:{alternativeGroup}:{description["requires:".Length..]}"
                        : description);
                }
                pendingAlternatives.Clear();
                alternativeGroup++;
                continue;
            }
            foreach (var description in conditionDescriptions) descriptions.Add(description);
        }
        if (pendingAlternatives.Count > 0)
        {
            foreach (var description in pendingAlternatives.Distinct(StringComparer.Ordinal))
            {
                descriptions.Add(description.StartsWith("requires:", StringComparison.Ordinal)
                    ? $"requires:any:{alternativeGroup}:{description["requires:".Length..]}"
                    : description);
            }
        }
        return descriptions.ToArray();
    }

    private static bool IsIncidentalConditionReference(string formKey) => formKey.Equals("000014:Skyrim.esm", StringComparison.OrdinalIgnoreCase);

    private static IEnumerable<string> FindConditionFormKeys(object source)
    {
        var visited = new HashSet<object>(ReferenceEqualityComparer.Instance);
        var pending = new Stack<object>();
        pending.Push(source);
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            if (!visited.Add(current)) continue;
            if (ExplicitFormKeyText(current) is { } text) yield return text;
            foreach (var property in current.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
            {
                if (property.GetIndexParameters().Length > 0 || property.Name is "Registration" or "TranslationMask" or "RecordType" or "Type" or "Assembly" or "ImplementedInterfaces") continue;
                object? value;
                try { value = property.GetValue(current); } catch { continue; }
                if (value is null || value is string || value.GetType().IsPrimitive || value is decimal || value is Enum) continue;
                if (value is IEnumerable enumerable)
                {
                    foreach (var child in enumerable.Cast<object?>().Where(child => child is not null).Take(64)) pending.Push(child!);
                }
                else if (value.GetType().Namespace?.StartsWith("Mutagen", StringComparison.Ordinal) == true) pending.Push(value);
            }
        }
    }

    private static string? ExplicitFormKeyText(object source)
    {
        var typeName = source.GetType().FullName ?? string.Empty;
        if (typeName.EndsWith("FormKey", StringComparison.Ordinal)) return FormKeyText(source);
        var value = ReadProperty(source, "FormKey") ?? source.GetType().GetField("FormKey", BindingFlags.Public | BindingFlags.Instance)?.GetValue(source);
        return value is null ? null : FormKeyText(value);
    }

    private static RecipeClassification? InferProfession(string? editorId, string? workbench, RecordCandidate candidate, ProfessionGate? gate)
    {
        if (gate is not null) return new RecipeClassification(gate.Profession, gate.MasteryTier);
        var id = editorId ?? string.Empty;
        if (id.StartsWith("KzlRecipePot_", StringComparison.OrdinalIgnoreCase) || workbench?.Equals("042E6B:Keizaal.esp", StringComparison.OrdinalIgnoreCase) == true)
            return new RecipeClassification("Alchemy", "Novice");
        if (id.StartsWith("KzlRecipeFood_", StringComparison.OrdinalIgnoreCase))
            return new RecipeClassification("Cooking", "Novice");
        if (id.StartsWith("KzlRecipeCharcoalTier1", StringComparison.OrdinalIgnoreCase))
            return new RecipeClassification("Woodworking", "Novice");
        if (Regex.IsMatch(id, "(MCERecipeClothes|Recipe.*(Clothes|Robe|Tunic|Apron|Dress|Boots|Gloves|Hat|Cowl|Cape|Cloak|Scarf|Mantle|Gaiter))", RegexOptions.IgnoreCase) &&
            (candidate.IdentityPlugin.Contains("Craftable", StringComparison.OrdinalIgnoreCase) || candidate.IdentityPlugin.Contains("CommonClothes", StringComparison.OrdinalIgnoreCase) || candidate.WinningPlugin.Contains("KzlOnlineMods", StringComparison.OrdinalIgnoreCase)))
            return new RecipeClassification("Tailoring", "Novice");
        return null;
    }

    private static IReadOnlyList<string> ReadLoadOrder(string path)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var plugins = new List<string>();
        foreach (var raw in File.ReadLines(path))
        {
            var item = raw.Trim();
            if (item.StartsWith('#') || item.Length == 0) continue;
            item = item.TrimStart('*').Trim();
            if (!item.EndsWith(".esm", StringComparison.OrdinalIgnoreCase) &&
                !item.EndsWith(".esp", StringComparison.OrdinalIgnoreCase) &&
                !item.EndsWith(".esl", StringComparison.OrdinalIgnoreCase)) continue;
            if (seen.Add(item)) plugins.Add(item);
        }
        if (plugins.Count == 0) throw new ArgumentException("The supplied load order contains no .esm, .esp, or .esl plugins.");
        return plugins;
    }

    private static IReadOnlyList<string> WithImplicitMasters(IReadOnlyList<string> configuredPlugins, string dataFolder)
    {
        // Skyrim does not write its five always-loaded masters to plugins.txt. They are still
        // part of the effective load order and contain most inventory records and base recipes.
        var implicitMasters = new[] { "Skyrim.esm", "Update.esm", "Dawnguard.esm", "HearthFires.esm", "Dragonborn.esm" };
        var seen = configuredPlugins.ToHashSet(StringComparer.OrdinalIgnoreCase);
        return implicitMasters.Where(plugin => File.Exists(Path.Combine(dataFolder, plugin)) && seen.Add(plugin))
            .Concat(configuredPlugins)
            .ToArray();
    }

    private static string RecordType(IMajorRecordGetter record)
    {
        var name = record.GetType().Name;
        return name.Replace("BinaryOverlay", string.Empty, StringComparison.Ordinal)
            .Replace("Getter", string.Empty, StringComparison.Ordinal)
            .Replace("Overlay", string.Empty, StringComparison.Ordinal);
    }

    private static object? ReadProperty(object source, string propertyName) =>
        source.GetType().GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance)?.GetValue(source);

    private static string? LocalFormId(object record)
    {
        var formKey = ReadProperty(record, "FormKey");
        if (formKey is null) return null;

        // FormKey.ID is a public field in Mutagen, rather than a property. IDString is the
        // clearest API surface when available; the formatted FormKey fallback is deliberately
        // parsed before accepting it so we never leak "ABC:Plugin.esp" into a local Form ID.
        var idString = ReadProperty(formKey, "IDString")?.ToString();
        if (FormatLocalId(idString) is { } formatted) return formatted;
        var idField = formKey.GetType().GetField("ID", BindingFlags.Public | BindingFlags.Instance)?.GetValue(formKey);
        if (TryFormatNumericId(idField, out formatted)) return formatted;
        var leftOfPlugin = formKey.ToString()?.Split(':', 2)[0];
        return FormatLocalId(leftOfPlugin);
    }

    private static string? OriginPlugin(string formKey)
    {
        var parts = formKey.Split(':', 2, StringSplitOptions.TrimEntries);
        return parts.Length == 2 && parts[1].Length > 0 ? parts[1] : null;
    }

    private static string? FormatLocalId(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate) || !Regex.IsMatch(candidate, "^[0-9a-fA-F]{1,8}$")) return null;
        return uint.Parse(candidate, System.Globalization.NumberStyles.AllowHexSpecifier, System.Globalization.CultureInfo.InvariantCulture)
            .ToString("X8", System.Globalization.CultureInfo.InvariantCulture);
    }

    private static bool TryFormatNumericId(object? value, out string? formatted)
    {
        try
        {
            if (value is not null)
            {
                formatted = Convert.ToUInt32(value, System.Globalization.CultureInfo.InvariantCulture)
                    .ToString("X8", System.Globalization.CultureInfo.InvariantCulture);
                return true;
            }
        }
        catch (InvalidCastException) { }
        catch (FormatException) { }
        formatted = null;
        return false;
    }

    private static string? ReadString(object source, string propertyName) => ReadProperty(source, propertyName)?.ToString();

    private static string? ReadTranslatedString(object source, string propertyName)
    {
        var value = ReadProperty(source, propertyName);
        if (value is null) return null;
        var stringValue = ReadProperty(value, "String")?.ToString();
        return string.IsNullOrWhiteSpace(stringValue) ? null : stringValue;
    }

    private static decimal? ReadDecimal(object source, string propertyName)
    {
        var value = ReadProperty(source, propertyName);
        return value is null ? null : Convert.ToDecimal(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static float? ReadFloat(object source, string propertyName)
    {
        var value = ReadProperty(source, propertyName);
        return value is null ? null : Convert.ToSingle(value, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static string? ReadModelPath(object source)
    {
        var model = ReadProperty(source, "Model");
        var direct = model is null ? null : ReadString(model, "File");
        if (!string.IsNullOrWhiteSpace(direct)) return direct;

        // ARMO records keep their inventory/ground model in WorldModel rather than Model.
        // Prefer the male model because Skyrim normally supplies it even for unisex items,
        // then fall back to the female entry for female-only clothing and armor.
        var worldModel = ReadProperty(source, "WorldModel");
        foreach (var variantName in new[] { "Male", "Female" })
        {
            var variant = worldModel is null ? null : ReadProperty(worldModel, variantName);
            if (variant is null) continue;
            var nestedModel = ReadProperty(variant, "Model");
            var path = nestedModel is null ? ReadString(variant, "File") : ReadString(nestedModel, "File");
            if (!string.IsNullOrWhiteSpace(path)) return path;
        }

        return null;
    }

    private static IReadOnlyList<string> BuildAliases(string name, string? editorId)
    {
        return new[] { name, editorId }
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
    }

    private static IReadOnlyDictionary<string, string> ExtractMetadata(object record, string recordType)
    {
        var wanted = new[] { "Damage", "ArmorRating", "ArmorType", "EquipmentType", "Slots", "Description", "Enchantment", "Keywords", "Effects" };
        var metadata = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["recordType"] = recordType,
        };
        foreach (var name in wanted)
        {
            var value = ReadProperty(record, name) ?? ReadProperty(ReadProperty(record, "BasicStats") ?? record, name);
            if (value is null) continue;
            if (value is IEnumerable values and not string)
            {
                var collected = values.Cast<object?>().Select(value => value?.ToString()).Where(value => !string.IsNullOrWhiteSpace(value)).Take(24);
                var text = string.Join("; ", collected!);
                if (!string.IsNullOrWhiteSpace(text)) metadata[name] = text;
                continue;
            }
            metadata[name] = value.ToString() ?? string.Empty;
        }
        return metadata;
    }

    // IdentityPlugin is the original FormKey's plugin, while WinningPlugin is the plugin that
    // supplied the effective override. Keeping both avoids collisions when one patch overrides
    // records with identical local IDs from two different origin plugins.
    private sealed record RecordCandidate(string IdentityPlugin, string WinningPlugin, string FormId, string RecordType, IMajorRecordGetter Record);
}

internal sealed record WorkbenchOverride(string EditorIdContains, string? WorkbenchKey, string Source);
internal sealed record ProfessionGate(string Profession, string MasteryTier, string EditorId);
internal sealed record RecipeClassification(string Profession, string MasteryTier);
internal sealed record ConditionReference(string Label, string Kind);

internal sealed class ProfessionGateCatalog
{
    private readonly Dictionary<string, ProfessionGate> byFormKey = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, ConditionReference> references = new(StringComparer.OrdinalIgnoreCase);

    public void Add(string formKey, string? editorId, string? displayName, string recordType)
    {
        var label = !string.IsNullOrWhiteSpace(displayName) && !displayName.Equals(editorId, StringComparison.OrdinalIgnoreCase)
            ? displayName
            : Humanize(editorId) ?? formKey;
        var kind = recordType switch { "Book" => "book", "Perk" => "perk", _ => "record" };
        references[formKey] = new ConditionReference(label, kind);
        var gate = Parse(editorId);
        if (gate is null) return;
        byFormKey[formKey] = gate;
    }

    public bool TryGet(string formKey, out ProfessionGate gate) => byFormKey.TryGetValue(formKey, out gate!);
    public string Requirement(string formKey)
    {
        var reference = references.GetValueOrDefault(formKey) ?? new ConditionReference(formKey, "record");
        return $"requires:{reference.Kind}:{reference.Label}";
    }

    public static int TierRank(string tier) => tier switch { "Master" => 4, "Expert" => 3, "Advanced" => 2, _ => 1 };

    private static string? Humanize(string? editorId)
    {
        if (string.IsNullOrWhiteSpace(editorId)) return null;
        var value = Regex.Replace(editorId, "^(Kzl|KZL)", string.Empty);
        value = Regex.Replace(value, "([a-z0-9])([A-Z])", "$1 $2");
        value = Regex.Replace(value, "[_-]+", " ");
        return Regex.Replace(value, "\\s+", " ").Trim();
    }

    private static ProfessionGate? Parse(string? editorId)
    {
        if (string.IsNullOrWhiteSpace(editorId)) return null;
        var custom = Regex.Match(editorId, "^Kzl(Alchemy|Cooking|Mining|Smithing|Tailor|Woodcutter)(Novice|Advanced|Expert|Master)$", RegexOptions.IgnoreCase);
        if (custom.Success)
        {
            var profession = custom.Groups[1].Value.ToLowerInvariant() switch
            {
                "tailor" => "Tailoring",
                "woodcutter" => "Woodworking",
                var value => char.ToUpperInvariant(value[0]) + value[1..],
            };
            var tier = char.ToUpperInvariant(custom.Groups[2].Value[0]) + custom.Groups[2].Value[1..].ToLowerInvariant();
            return new ProfessionGate(profession, tier, editorId);
        }
        var alchemist = Regex.Match(editorId, "^Alchemist(00|20|40|60)$", RegexOptions.IgnoreCase);
        if (!alchemist.Success) return null;
        var mastery = alchemist.Groups[1].Value switch { "20" => "Advanced", "40" => "Expert", "60" => "Master", _ => "Novice" };
        return new ProfessionGate("Alchemy", mastery, editorId);
    }
}

internal static class SkyPatcherWorkbenchOverrides
{
    public static IReadOnlyList<WorkbenchOverride> Load(string dataFolder)
    {
        var root = Path.Combine(dataFolder, "SKSE", "Plugins", "SkyPatcher", "constructibleObject");
        if (!Directory.Exists(root)) return [];
        var rules = new List<WorkbenchOverride>();
        foreach (var path in Directory.EnumerateFiles(root, "*.ini", SearchOption.AllDirectories).OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            foreach (var raw in File.ReadLines(path))
            {
                var line = raw.Trim();
                const string prefix = "filterByEditorIdContains=";
                if (!line.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)) continue;
                var parts = line[prefix.Length..].Split(":workbenchKeyword=", 2, StringSplitOptions.None);
                if (parts.Length != 2 || string.IsNullOrWhiteSpace(parts[0])) continue;
                var workbench = ParseWorkbench(parts[1].Trim());
                if (workbench is null && !parts[1].Trim().Equals("null", StringComparison.OrdinalIgnoreCase)) continue;
                rules.Add(new WorkbenchOverride(parts[0].Trim(), workbench, Path.GetRelativePath(root, path).Replace('\\', '/')));
            }
        }
        return rules;
    }

    private static string? ParseWorkbench(string value)
    {
        if (value.Equals("null", StringComparison.OrdinalIgnoreCase)) return null;
        var parts = value.Split('|', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !Regex.IsMatch(parts[1], "^[0-9a-fA-F]{1,8}$")) return null;
        return uint.Parse(parts[1], System.Globalization.NumberStyles.AllowHexSpecifier, System.Globalization.CultureInfo.InvariantCulture)
            .ToString("X6", System.Globalization.CultureInfo.InvariantCulture) + ":" + parts[0];
    }
}

internal static class CommerceCategory
{
    public static string For(string recordType, string name, string? editorId) => recordType switch
    {
        "Weapon" => "Weapons",
        "Armor" => IsJewelry(name, editorId) ? "Jewelry" : "Armor & clothing",
        "Ammunition" => "Ammunition",
        "Ingredient" => "Alchemy ingredients",
        "Ingestible" or "AlchemyItem" => PotionCategory(name, editorId),
        "SoulGem" => "Soul gems",
        "Book" => IsSpellTome(name, editorId) ? "Spell tomes" : "Books & scrolls",
        "Scroll" => "Books & scrolls",
        "Key" => "Keys",
        "Light" => "Tools & supplies",
        "Flora" or "Tree" => "Alchemy ingredients",
        _ => MiscCategory(name, editorId),
    };

    public static string FallbackIcon(string category, string name, string? editorId) => category switch
    {
        "Weapons" or "Ammunition" => "/catalog-icons/weapon.png",
        "Armor & clothing" or "Jewelry" => "/catalog-icons/armor.png",
        "Alchemy ingredients" => "/catalog-icons/flower.png",
        "Potions & poisons" => "/catalog-icons/potion.png",
        "Food & drink" => "/catalog-icons/food.png",
        "Books & scrolls" or "Spell tomes" => "/catalog-icons/book.png",
        "Ores & ingots" => IsIngot(name, editorId) ? "/catalog-icons/ingot.png" : "/catalog-icons/ore.png",
        _ => "/catalog-icons/misc.png",
    };

    private static bool IsJewelry(string name, string? editorId) => Contains(name, "ring", "necklace", "amulet") || Contains(editorId, "jewelry");
    private static bool IsSpellTome(string name, string? editorId) => Contains(name, "spell tome") || Contains(editorId, "spell_tome");
    private static bool IsIngot(string name, string? editorId) => Contains(name, "ingot") || Contains(editorId, "ingot");
    private static string PotionCategory(string name, string? editorId) => Contains(name, "stew", "bread", "meat", "cheese", "wine", "ale", "mead") || Contains(editorId, "food") ? "Food & drink" : "Potions & poisons";
    private static string MiscCategory(string name, string? editorId)
    {
        if (Contains(name, "ore") || IsIngot(name, editorId) || Contains(editorId, "ore")) return "Ores & ingots";
        if (Contains(name, "hide") || Contains(name, "pelt") || Contains(name, "leather")) return "Hides & leather";
        if (Contains(name, "lockpick")) return "Tools & supplies";
        return "Miscellaneous";
    }
    private static bool Contains(string? value, params string[] terms) => value is not null && terms.Any(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));
}

internal static class ArtworkManifest
{
    public static IReadOnlyDictionary<string, string> Load(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return new Dictionary<string, string>();
        if (!File.Exists(path)) throw new FileNotFoundException("Artwork manifest was not found.", path);
        var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(path));
        return data is null
            ? throw new InvalidDataException("Artwork manifest must be a JSON object mapping stable item keys to web image paths.")
            : new Dictionary<string, string>(data, StringComparer.OrdinalIgnoreCase);
    }
}
