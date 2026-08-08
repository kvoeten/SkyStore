using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Mutagen.Bethesda;
using Mutagen.Bethesda.Archives;

namespace SkyStore.ItemRenderer;

internal static partial class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static int Main(string[] args)
    {
        try
        {
            var options = RendererOptions.Parse(args);
            Directory.CreateDirectory(options.OutputDirectory);
            var catalog = JsonSerializer.Deserialize<CatalogBundle>(File.ReadAllText(options.CatalogPath), JsonOptions)
                ?? throw new InvalidOperationException("Catalog JSON could not be parsed.");
            var targets = TargetSelector.Select(catalog, options.OutputDirectory);
            if (options.Matches.Count > 0)
                targets = targets.Where(target => options.Matches.Any(match => target.Name.Contains(match, StringComparison.OrdinalIgnoreCase))).ToList();
            if (options.Limit is > 0) targets = targets.Take(options.Limit.Value).ToList();

            var manifest = new RenderTargetManifest(catalog.Version, targets);
            WriteJson(Path.Combine(options.OutputDirectory, "render-targets.json"), manifest);
            Console.WriteLine($"Selected {targets.Count} item renders from catalog {catalog.Version}.");

            if (options.ManifestOnly)
            {
                WriteArtworkManifest(options.OutputDirectory, targets.Where(target => File.Exists(target.OutputPath)));
                return 0;
            }

            var workspace = Path.Combine(options.OutputDirectory, "work");
            Directory.CreateDirectory(workspace);
            var assets = new AssetResolver(options.DataDirectory, options.LoadOrderPath);
            var prepared = new List<PreparedRender>();
            var outcomes = new List<RenderOutcome>();
            foreach (var target in targets)
            {
                if (string.IsNullOrWhiteSpace(target.ModelPath))
                {
                    outcomes.Add(new(target.StableKey, target.Name, "missing_model_path", null));
                    continue;
                }
                if (!options.Force && File.Exists(target.OutputPath))
                {
                    outcomes.Add(new(target.StableKey, target.Name, "rendered", "Existing PNG retained; pass --force to regenerate it."));
                    continue;
                }

                try
                {
                    var extracted = assets.ExtractModelAndTextures(target.ModelPath, workspace);
                    prepared.Add(new(target, extracted.ModelFile, target.OutputPath));
                    outcomes.Add(new(target.StableKey, target.Name, "prepared", extracted.MissingTextures.Count == 0 ? null : $"Missing textures: {string.Join(", ", extracted.MissingTextures)}"));
                }
                catch (Exception exception)
                {
                    outcomes.Add(new(target.StableKey, target.Name, "asset_error", exception.Message));
                }
            }

            if (!options.PrepareOnly && prepared.Count > 0)
            {
                ValidateRenderer(options);
                foreach (var batch in prepared.Chunk(options.BatchSize))
                {
                    var batchPath = Path.Combine(workspace, $"batch-{Guid.NewGuid():N}.json");
                    WriteJson(batchPath, new BlenderBatch(workspace, batch.ToList()));
                    RunBlender(options, batchPath);
                    File.Delete(batchPath);
                }
            }

            var completed = targets.Where(target => File.Exists(target.OutputPath)).ToList();
            WriteArtworkManifest(options.OutputDirectory, completed);
            var finalized = outcomes.Select(outcome => File.Exists(targets.First(target => target.StableKey == outcome.StableKey).OutputPath)
                ? outcome with { Status = "rendered" }
                : outcome).ToList();
            WriteJson(Path.Combine(options.OutputDirectory, "render-report.json"), new RenderReport(
                catalog.Version,
                targets.Count,
                completed.Count,
                finalized.Count(outcome => outcome.Status == "missing_model_path"),
                finalized.Count(outcome => outcome.Status == "asset_error"),
                finalized));

            Console.WriteLine(options.PrepareOnly
                ? $"Prepared {prepared.Count} models. Blender was not run."
                : $"Rendered {completed.Count} of {targets.Count} selected items.");
            var expectedRenders = targets.Count - finalized.Count(outcome => outcome.Status is "missing_model_path" or "asset_error");
            if (!options.PrepareOnly && completed.Count != expectedRenders)
                throw new InvalidOperationException($"Only {completed.Count} of {expectedRenders} renderable targets produced PNG files. See render-report.json.");
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
            return 1;
        }
    }

    private static void ValidateRenderer(RendererOptions options)
    {
        if (!File.Exists(options.BlenderPath)) throw new FileNotFoundException("Blender executable was not found. Pass --blender.", options.BlenderPath);
        if (!Directory.Exists(options.PyNiflyPath) || !File.Exists(Path.Combine(options.PyNiflyPath, "__init__.py")))
            throw new DirectoryNotFoundException($"PyNifly add-on directory was not found at {options.PyNiflyPath}. Pass --pynifly with the io_scene_nifly directory.");
    }

    private static void RunBlender(RendererOptions options, string batchPath)
    {
        var script = Path.Combine(AppContext.BaseDirectory, "render_nifs.py");
        if (!File.Exists(script)) script = Path.Combine(Directory.GetCurrentDirectory(), "tools", "SkyStore.ItemRenderer", "render_nifs.py");
        if (!File.Exists(script)) throw new FileNotFoundException("Blender render script was not found.", script);

        var start = new ProcessStartInfo(options.BlenderPath)
        {
            UseShellExecute = false,
        };
        start.ArgumentList.Add("--background");
        start.ArgumentList.Add("--factory-startup");
        start.ArgumentList.Add("--python-exit-code");
        start.ArgumentList.Add("1");
        start.ArgumentList.Add("--python");
        start.ArgumentList.Add(script);
        start.ArgumentList.Add("--");
        start.ArgumentList.Add("--batch");
        start.ArgumentList.Add(batchPath);
        start.ArgumentList.Add("--pynifly");
        start.ArgumentList.Add(options.PyNiflyPath);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("Blender could not be started.");
        process.WaitForExit();
        if (process.ExitCode != 0) throw new InvalidOperationException($"Blender exited with code {process.ExitCode} while rendering {batchPath}.");
    }

    private static void WriteArtworkManifest(string outputDirectory, IEnumerable<RenderTarget> targets)
    {
        var mapping = targets.OrderBy(target => target.StableKey, StringComparer.Ordinal)
            .ToDictionary(target => target.StableKey, target => target.WebPath, StringComparer.OrdinalIgnoreCase);
        WriteJson(Path.Combine(outputDirectory, "artwork-manifest.json"), mapping);
    }

    private static void WriteJson<T>(string path, T value) => File.WriteAllText(path, JsonSerializer.Serialize(value, JsonOptions) + Environment.NewLine);

    [GeneratedRegex(@"(?i)(?:textures[\\/])?[^\x00\r\n\t]+?\.dds")]
    public static partial Regex TexturePathRegex();
}

internal sealed record RendererOptions(
    string CatalogPath,
    string DataDirectory,
    string LoadOrderPath,
    string OutputDirectory,
    string BlenderPath,
    string PyNiflyPath,
    bool ManifestOnly,
    bool PrepareOnly,
    bool Force,
    IReadOnlyList<string> Matches,
    int? Limit,
    int BatchSize)
{
    public static RendererOptions Parse(string[] args)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var flags = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var index = 0; index < args.Length; index++)
        {
            if (!args[index].StartsWith("--", StringComparison.Ordinal)) throw new ArgumentException($"Unexpected argument {args[index]}.");
            if (args[index] is "--manifest-only" or "--prepare-only" or "--force") flags.Add(args[index]);
            else if (++index >= args.Length) throw new ArgumentException($"Missing value for {args[index - 1]}.");
            else values[args[index - 1]] = args[index];
        }

        string Required(string name) => values.TryGetValue(name, out var value) ? Path.GetFullPath(value) : throw new ArgumentException($"{name} is required.");
        var defaultBlender = @"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe";
        return new(
            Required("--catalog"),
            Required("--data"),
            Required("--load-order"),
            Required("--output"),
            Path.GetFullPath(values.GetValueOrDefault("--blender", defaultBlender)),
            Required("--pynifly"),
            flags.Contains("--manifest-only"),
            flags.Contains("--prepare-only"),
            flags.Contains("--force"),
            values.TryGetValue("--match", out var matches) ? matches.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) : [],
            values.TryGetValue("--limit", out var limit) ? int.Parse(limit) : null,
            values.TryGetValue("--batch-size", out var batchSize) ? int.Parse(batchSize) : 20);
    }
}

internal static class TargetSelector
{
    public static List<RenderTarget> Select(CatalogBundle catalog, string outputDirectory)
    {
        var items = catalog.Items.ToDictionary(item => item.StableKey, StringComparer.OrdinalIgnoreCase);
        var byName = catalog.Items.GroupBy(item => Normalize(item.Name)).ToDictionary(group => group.Key, group => group.ToList(), StringComparer.OrdinalIgnoreCase);
        var roles = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
        void Add(string? stableKey, string role)
        {
            if (stableKey is null || !items.ContainsKey(stableKey)) return;
            if (!roles.TryGetValue(stableKey, out var itemRoles)) roles[stableKey] = itemRoles = new(StringComparer.OrdinalIgnoreCase);
            itemRoles.Add(role);
        }

        foreach (var recipe in catalog.Recipes.Where(recipe => !string.IsNullOrWhiteSpace(recipe.Profession)))
        {
            Add(recipe.OutputStableKey, $"output:{recipe.Profession!.ToLowerInvariant()}");
            foreach (var ingredient in recipe.Ingredients) Add(ingredient.ItemStableKey, "ingredient");
            foreach (var condition in recipe.Conditions.Where(condition => !condition.StartsWith("requires:profession:", StringComparison.OrdinalIgnoreCase)))
            {
                var label = condition.Split(':').LastOrDefault();
                if (label is null || !byName.TryGetValue(Normalize(label), out var matches)) continue;
                foreach (var match in matches) Add(match.StableKey, "inventory_requirement");
            }
        }

        var imageDirectory = Path.Combine(outputDirectory, "images");
        var versionSlug = string.Concat(catalog.Version.ToLowerInvariant().Select(character => char.IsLetterOrDigit(character) || character == '-' ? character : '-'));
        Directory.CreateDirectory(imageDirectory);
        return roles.Select(pair =>
        {
            var item = items[pair.Key];
            // Render URLs are immutable, so include the catalog version to prevent a
            // changed winning model from being hidden by a year-long browser cache.
            var fileName = $"{item.Id:D}-{versionSlug}.png";
            return new RenderTarget(
                item.Id,
                item.StableKey,
                item.Name,
                item.RecordType,
                item.Artwork.ModelPath,
                pair.Value.OrderBy(value => value, StringComparer.Ordinal).ToList(),
                Path.Combine(imageDirectory, fileName),
                $"/item-renders/{fileName}");
        }).OrderBy(target => target.Name, StringComparer.OrdinalIgnoreCase).ThenBy(target => target.StableKey, StringComparer.Ordinal).ToList();
    }

    private static string Normalize(string value) => string.Concat(value.Normalize(NormalizationForm.FormKD).Where(char.IsLetterOrDigit)).ToLowerInvariant();
}

internal sealed class AssetResolver
{
    private readonly string _dataDirectory;
    private readonly Dictionary<string, IArchiveFile> _archiveFiles = new(StringComparer.OrdinalIgnoreCase);

    public AssetResolver(string dataDirectory, string loadOrderPath)
    {
        _dataDirectory = Path.GetFullPath(dataDirectory);
        IndexArchives(loadOrderPath);
    }

    public ExtractedModel ExtractModelAndTextures(string modelPath, string workspace)
    {
        var relativeModel = NormalizeAssetPath(modelPath, "meshes");
        var modelBytes = ReadAsset(relativeModel) ?? throw new FileNotFoundException($"Model asset {relativeModel} was not found in loose files or loaded BSAs.");
        var modelFile = WriteAsset(workspace, relativeModel, modelBytes);
        var missing = new List<string>();
        foreach (Match match in Program.TexturePathRegex().Matches(Encoding.Latin1.GetString(modelBytes)))
        {
            var relativeTexture = NormalizeAssetPath(match.Value, "textures");
            var bytes = ReadAsset(relativeTexture);
            if (bytes is null) missing.Add(relativeTexture);
            else WriteAsset(workspace, relativeTexture, bytes);
        }
        return new(modelFile, missing.Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(value => value, StringComparer.OrdinalIgnoreCase).ToList());
    }

    private void IndexArchives(string loadOrderPath)
    {
        var plugins = File.ReadAllLines(loadOrderPath)
            .Select(line => line.Trim().TrimStart('*'))
            .Where(line => !string.IsNullOrWhiteSpace(line) && !line.StartsWith('#'))
            .ToList();
        var archives = Directory.EnumerateFiles(_dataDirectory, "*.bsa", SearchOption.TopDirectoryOnly).ToList();
        var ordered = archives.OrderBy(path => ArchiveRank(Path.GetFileNameWithoutExtension(path), plugins)).ThenBy(path => path, StringComparer.OrdinalIgnoreCase).ToList();
        foreach (var archivePath in ordered)
        {
            var reader = Archive.CreateReader(GameRelease.SkyrimSE, archivePath);
            foreach (var file in reader.Files)
            {
                var path = NormalizeSlashes(file.Path);
                if (path.EndsWith(".nif", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".dds", StringComparison.OrdinalIgnoreCase))
                    _archiveFiles[path] = file;
            }
        }
        Console.WriteLine($"Indexed {_archiveFiles.Count:N0} model and texture assets from {ordered.Count} BSAs.");
    }

    private static int ArchiveRank(string archiveName, IReadOnlyList<string> plugins)
    {
        for (var index = 0; index < plugins.Count; index++)
        {
            var pluginName = Path.GetFileNameWithoutExtension(plugins[index]);
            if (archiveName.Equals(pluginName, StringComparison.OrdinalIgnoreCase) || archiveName.StartsWith(pluginName + " - ", StringComparison.OrdinalIgnoreCase)) return index;
        }
        return -1;
    }

    private byte[]? ReadAsset(string relativePath)
    {
        var loose = Path.Combine(_dataDirectory, relativePath.Replace('/', Path.DirectorySeparatorChar));
        if (File.Exists(loose)) return File.ReadAllBytes(loose);
        return _archiveFiles.TryGetValue(relativePath, out var entry) ? entry.GetBytes() : null;
    }

    private static string WriteAsset(string workspace, string relativePath, byte[] bytes)
    {
        var output = Path.GetFullPath(Path.Combine(workspace, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        if (!output.StartsWith(Path.GetFullPath(workspace) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException($"Unsafe asset path {relativePath}.");
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        File.WriteAllBytes(output, bytes);
        return output;
    }

    private static string NormalizeAssetPath(string value, string root)
    {
        var normalized = NormalizeSlashes(value.Trim().TrimStart('/', '\\'));
        var embeddedRoot = normalized.LastIndexOf(root + "/", StringComparison.OrdinalIgnoreCase);
        if (embeddedRoot > 0) normalized = normalized[embeddedRoot..];
        if (!normalized.StartsWith(root + "/", StringComparison.OrdinalIgnoreCase)) normalized = $"{root}/{normalized}";
        if (normalized.Split('/').Any(segment => segment == "..")) throw new InvalidOperationException($"Unsafe asset path {value}.");
        return normalized;
    }

    private static string NormalizeSlashes(string value) => value.Replace('\\', '/').TrimStart('/');
}

internal sealed record CatalogBundle(string Version, List<CatalogItem> Items, List<CatalogRecipe> Recipes);
internal sealed record CatalogItem(Guid Id, string StableKey, string Name, string RecordType, CatalogArtwork Artwork);
internal sealed record CatalogArtwork(string? ModelPath);
internal sealed record CatalogRecipe(string? OutputStableKey, List<CatalogRecipeIngredient> Ingredients, string? Profession, List<string> Conditions);
internal sealed record CatalogRecipeIngredient(string? ItemStableKey);
internal sealed record RenderTarget(Guid Id, string StableKey, string Name, string RecordType, string? ModelPath, IReadOnlyList<string> Roles, [property: JsonIgnore] string OutputPath, string WebPath);
internal sealed record RenderTargetManifest(string CatalogVersion, IReadOnlyList<RenderTarget> Targets);
internal sealed record PreparedRender(RenderTarget Target, string ModelFile, string OutputPath);
internal sealed record BlenderBatch(string AssetRoot, IReadOnlyList<PreparedRender> Items);
internal sealed record ExtractedModel(string ModelFile, IReadOnlyList<string> MissingTextures);
internal sealed record RenderOutcome(string StableKey, string Name, string Status, string? Detail);
internal sealed record RenderReport(string CatalogVersion, int TargetCount, int RenderedCount, int MissingModelCount, int AssetErrorCount, IReadOnlyList<RenderOutcome> Outcomes);
