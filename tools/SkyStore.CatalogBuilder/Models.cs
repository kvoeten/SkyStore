using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace SkyStore.CatalogBuilder;

public sealed record CatalogBundle(
    string SchemaVersion,
    string Version,
    DateTimeOffset GeneratedAt,
    CatalogSource Source,
    List<CatalogItem> Items,
    List<CatalogRecipe> Recipes);

public sealed record CatalogSource(string Game, string Release, string DataFolder, string LoadOrderSha256);

public sealed record CatalogItem(
    Guid Id,
    string StableKey,
    string Name,
    string? EditorId,
    string Plugin,
    string RecordType,
    string FormId,
    string Category,
    decimal? GameValue,
    float? Weight,
    CatalogArtwork Artwork,
    IReadOnlyList<string> Aliases,
    IReadOnlyDictionary<string, string> Metadata);

public sealed record CatalogArtwork(ArtworkStatus Status, string FallbackIcon, string? ModelPath, string? RenderPath);

public sealed record CatalogRecipe(
    Guid Id,
    string StableKey,
    string Plugin,
    string FormId,
    string? EditorId,
    string? OutputStableKey,
    int OutputYield,
    IReadOnlyList<CatalogRecipeIngredient> Ingredients,
    string? WorkbenchKey,
    string? Profession,
    string? MasteryTier,
    int? LaborFee,
    IReadOnlyList<string> Conditions,
    IReadOnlyList<RecipeMappingIssue> UnresolvedMappings,
    IReadOnlyList<string> Sources);

public sealed record CatalogRecipeIngredient(string? ItemStableKey, string SourceFormKey, int Quantity);
public sealed record RecipeMappingIssue(string Role, string? SourceFormKey, string Detail);

public enum ArtworkStatus
{
    Unresolved,
    Rendered,
}

public sealed record BuildReport(
    string Version,
    string CatalogPath,
    int ItemCount,
    int UnresolvedArtworkCount,
    int RecipeCount,
    int RecipesWithUnresolvedMappings,
    IReadOnlyDictionary<string, int> CategoryCounts);

public sealed record ValidationReport(bool IsValid, string? CatalogPath, int ItemCount, IReadOnlyList<string> Errors);

internal static class StableIdentity
{
    // Stable SkyStore namespace UUID. Item IDs are RFC 4122 version 5 values derived from it.
    private static readonly Guid ItemNamespace = new("6d8306da-02f0-5f18-9ae5-5f1d8081de4c");

    public static Guid ItemId(string plugin, string formId)
    {
        var name = $"skystore:item:{plugin.Trim().ToLowerInvariant()}:{formId.Trim().ToLowerInvariant()}";
        return CreateVersion5(ItemNamespace, name);
    }

    public static Guid RecipeId(string plugin, string formId)
    {
        var name = $"skystore:recipe:{plugin.Trim().ToLowerInvariant()}:{formId.Trim().ToLowerInvariant()}";
        return CreateVersion5(ItemNamespace, name);
    }

    public static string LoadOrderChecksum(IEnumerable<string> plugins)
    {
        var normalized = string.Join("\n", plugins.Select(plugin => plugin.Trim().ToLowerInvariant()));
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(normalized))).ToLowerInvariant();
    }

    public static string CatalogVersion(string loadOrderChecksum)
    {
        return $"v1-{loadOrderChecksum[..12]}";
    }

    private static Guid CreateVersion5(Guid namespaceId, string name)
    {
        Span<byte> namespaceBytes = stackalloc byte[16];
        namespaceId.TryWriteBytes(namespaceBytes);
        SwapGuidByteOrder(namespaceBytes);
        var nameBytes = Encoding.UTF8.GetBytes(name);
        var input = new byte[namespaceBytes.Length + nameBytes.Length];
        namespaceBytes.CopyTo(input);
        nameBytes.CopyTo(input.AsSpan(namespaceBytes.Length));
        var hash = SHA1.HashData(input);
        hash[6] = (byte)((hash[6] & 0x0f) | 0x50); // RFC 4122 version 5
        hash[8] = (byte)((hash[8] & 0x3f) | 0x80); // RFC 4122 variant
        Span<byte> guidBytes = hash[..16];
        SwapGuidByteOrder(guidBytes);
        return new Guid(guidBytes);
    }

    // Guid uses little-endian ordering for its first three fields on .NET; UUID v5 hashes use
    // network byte order. Swapping before and after hashing keeps the emitted Guid RFC compliant.
    private static void SwapGuidByteOrder(Span<byte> bytes)
    {
        (bytes[0], bytes[3]) = (bytes[3], bytes[0]);
        (bytes[1], bytes[2]) = (bytes[2], bytes[1]);
        (bytes[4], bytes[5]) = (bytes[5], bytes[4]);
        (bytes[6], bytes[7]) = (bytes[7], bytes[6]);
    }
}

internal static class CatalogValidator
{
    public static ValidationReport Validate(string outputDirectory)
    {
        var path = Path.Combine(outputDirectory, "skystore-catalog-current.json");
        if (!File.Exists(path))
        {
            return new ValidationReport(false, path, 0, ["Current catalog file does not exist."]);
        }

        var catalog = JsonSerializer.Deserialize<CatalogBundle>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (catalog is null)
        {
            return new ValidationReport(false, path, 0, ["Catalog JSON could not be parsed."]);
        }

        var errors = ValidateInMemory(catalog, throwOnFailure: false);
        return new ValidationReport(errors.Count == 0, path, catalog.Items.Count, errors);
    }

    public static void ValidateInMemory(CatalogBundle catalog)
    {
        var errors = ValidateInMemory(catalog, throwOnFailure: false);
        if (errors.Count > 0)
        {
            throw new InvalidOperationException($"Catalog validation failed: {string.Join(" ", errors)}");
        }
    }

    private static List<string> ValidateInMemory(CatalogBundle catalog, bool throwOnFailure)
    {
        var errors = new List<string>();
        if (catalog.SchemaVersion != "1") errors.Add("schemaVersion must be 1.");
        if (catalog.Items.Count == 0) errors.Add("catalog has no inventory-capable items.");
        if (catalog.Items.Select(item => item.Id).Distinct().Count() != catalog.Items.Count) errors.Add("catalog has duplicate stable IDs.");
        if (catalog.Items.Any(item => string.IsNullOrWhiteSpace(item.Name))) errors.Add("every item requires a display name.");
        if (catalog.Items.Any(item => string.IsNullOrWhiteSpace(item.Category))) errors.Add("every item requires a commerce category.");
        if (catalog.Items.Any(item => string.IsNullOrWhiteSpace(item.Artwork.FallbackIcon))) errors.Add("every item requires an artwork fallback icon.");
        if (catalog.Recipes.Select(recipe => recipe.Id).Distinct().Count() != catalog.Recipes.Count) errors.Add("catalog has duplicate recipe IDs.");
        if (catalog.Recipes.Any(recipe => recipe.OutputYield <= 0)) errors.Add("every recipe requires a positive output yield.");
        if (catalog.Recipes.Any(recipe => recipe.Ingredients.Any(ingredient => ingredient.Quantity <= 0))) errors.Add("every recipe ingredient requires a positive quantity.");
        return errors;
    }
}
