# See docs/DESIGN.md §18 for why Alpine (not "chiseled") and framework-dependent
# publish (not self-contained) were chosen.

# ---- Build ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY src/Backend/Backend.csproj src/Backend/
RUN dotnet restore src/Backend/Backend.csproj

COPY src/Backend/ src/Backend/
RUN dotnet publish src/Backend/Backend.csproj -c Release -o /app/publish --no-restore

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
WORKDIR /app
COPY --from=build /app/publish .

# .NET 8+ images already default to port 8080 and a non-root "app" user —
# nothing extra needed for either.
EXPOSE 8080

ENTRYPOINT ["dotnet", "Backend.dll"]
