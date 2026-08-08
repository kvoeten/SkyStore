using System.Text.Json;
using System.Text.Json.Serialization;

namespace SkyStore.CatalogBuilder;

internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static async Task<int> Main(string[] args)
    {
        try
        {
            var options = BuilderOptions.Parse(args);
            if (options.ValidateOnly)
            {
                var validation = CatalogValidator.Validate(options.OutputPath);
                Console.WriteLine(JsonSerializer.Serialize(validation, JsonOptions));
                return validation.IsValid ? 0 : 2;
            }

            Directory.CreateDirectory(options.OutputPath);
            var catalog = await MutagenSkyrimCatalogReader.BuildAsync(options);
            CatalogValidator.ValidateInMemory(catalog);

            var output = Path.Combine(options.OutputPath, $"skystore-catalog-{catalog.Version}.json");
            await File.WriteAllTextAsync(output, JsonSerializer.Serialize(catalog, JsonOptions));
            await File.WriteAllTextAsync(
                Path.Combine(options.OutputPath, "skystore-catalog-current.json"),
                JsonSerializer.Serialize(catalog, JsonOptions));

            var report = new BuildReport(
                catalog.Version,
                Path.GetFileName(output),
                catalog.Items.Count,
                catalog.Items.Count(item => item.Artwork.Status == ArtworkStatus.Unresolved),
                catalog.Recipes.Count,
                catalog.Recipes.Count(recipe => recipe.UnresolvedMappings.Count > 0),
                catalog.Items.GroupBy(item => item.Category).ToDictionary(group => group.Key, group => group.Count()));
            await File.WriteAllTextAsync(
                Path.Combine(options.OutputPath, "skystore-catalog-report.json"),
                JsonSerializer.Serialize(report, JsonOptions));

            Console.WriteLine(JsonSerializer.Serialize(report, JsonOptions));
            return 0;
        }
        catch (ArgumentException exception)
        {
            Console.Error.WriteLine(exception.Message);
            Console.Error.WriteLine(BuilderOptions.Usage);
            return 2;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"Catalog build failed: {exception.Message}");
            return 1;
        }
    }
}
