namespace SkyStore.CatalogBuilder;

public sealed record BuilderOptions(string DataFolder, string LoadOrderPath, string OutputPath, string Release, string? ArtworkManifestPath, bool ValidateOnly)
{
    public const string Usage = "Usage: SkyStore.CatalogBuilder --data <Skyrim Data folder> --load-order <plugins.txt> --output <directory> [--release se|ae] [--artwork-manifest <images.json>] | --validate --output <directory>";

    public static BuilderOptions Parse(string[] args)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var validateOnly = false;
        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];
            if (argument is "--help" or "-h") throw new ArgumentException(Usage);
            if (argument == "--validate")
            {
                validateOnly = true;
                continue;
            }
            if (!argument.StartsWith("--", StringComparison.Ordinal) || index + 1 >= args.Length)
            {
                throw new ArgumentException($"Invalid argument: {argument}");
            }
            values[argument] = args[++index];
        }

        if (!values.TryGetValue("--output", out var output) || string.IsNullOrWhiteSpace(output))
        {
            throw new ArgumentException("--output is required.");
        }
        if (validateOnly) return new BuilderOptions(string.Empty, string.Empty, Path.GetFullPath(output), "se", null, true);

        if (!values.TryGetValue("--data", out var data) || !Directory.Exists(data))
        {
            throw new ArgumentException("--data must point to an existing Skyrim Data folder.");
        }
        if (!values.TryGetValue("--load-order", out var loadOrder) || !File.Exists(loadOrder))
        {
            throw new ArgumentException("--load-order must point to an existing plugins.txt/load-order file.");
        }
        var release = values.GetValueOrDefault("--release", "se").ToLowerInvariant();
        if (release is not ("se" or "ae")) throw new ArgumentException("--release must be se or ae.");
        var artworkManifest = values.TryGetValue("--artwork-manifest", out var manifest) ? Path.GetFullPath(manifest) : null;
        return new BuilderOptions(Path.GetFullPath(data), Path.GetFullPath(loadOrder), Path.GetFullPath(output), release, artworkManifest, false);
    }
}
