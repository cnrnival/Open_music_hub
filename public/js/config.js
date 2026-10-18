// Centraliza endpoints públicos, rotas locais e parâmetros globais sem incluir segredos.
// Centralizes public endpoints, local routes, and global settings without including secrets.
const API_CONFIG = Object.freeze({
    searchDebounceMs: 300,
    providers: Object.freeze({
        deezer: Object.freeze({
            baseUrl: "https://api.deezer.com/",
            proxyBasePath: "/api/deezer",
            get searchRoute() {
                return `${this.proxyBasePath}/search`;
            },
            get detailRoutePrefix() {
                return `${this.proxyBasePath}/`;
            },
            endpoints: Object.freeze({
                search(type, query, limit = 8) {
                    return `search/${encodeURIComponent(type)}?q=${encodeURIComponent(query)}&limit=${limit}`;
                },
                artist(id) {
                    return `artist/${encodeURIComponent(id)}`;
                },
                artistTopTracks(id, limit = 50) {
                    return `artist/${encodeURIComponent(id)}/top?limit=${limit}`;
                },
                artistAlbums(id, limit = 10) {
                    return `artist/${encodeURIComponent(id)}/albums?limit=${limit}`;
                },
                album(id) {
                    return `album/${encodeURIComponent(id)}`;
                },
                albumTracks(id, limit = 100) {
                    return `album/${encodeURIComponent(id)}/tracks?limit=${limit}`;
                },
                playlist(id) {
                    return `playlist/${encodeURIComponent(id)}`;
                },
                playlistTracks(id, limit = 100) {
                    return `playlist/${encodeURIComponent(id)}/tracks?limit=${limit}`;
                },
                track(id) {
                    return `track/${encodeURIComponent(id)}`;
                }
            }),
            searchPath(query) {
                return `${this.searchRoute}?q=${encodeURIComponent(query)}`;
            },
            detailPath(kind, id) {
                return `${this.detailRoutePrefix}${encodeURIComponent(kind)}/${encodeURIComponent(id)}`;
            },
            artistAlbumsPath(id) {
                return `${this.detailRoutePrefix}artist/${encodeURIComponent(id)}/albums`;
            }
        }),
        invidious: Object.freeze({
            baseUrl: "https://invidious.nerdvpn.de/",
            proxyBasePath: "/api/invidious",
            get searchRoute() {
                return `${this.proxyBasePath}/search`;
            },
            get detailRoutePrefix() {
                return `${this.proxyBasePath}/videos/`;
            },
            endpoints: Object.freeze({
                search(query) {
                    return `api/v1/search?q=${encodeURIComponent(query)}&type=video`;
                },
                video(videoId) {
                    return `api/v1/videos/${encodeURIComponent(videoId)}`;
                }
            }),
            searchPath(query) {
                return `${this.searchRoute}?q=${encodeURIComponent(query)}`;
            },
            detailPath(videoId) {
                return `${this.detailRoutePrefix}${encodeURIComponent(videoId)}`;
            }
        }),
        spotify: Object.freeze({
            apiBaseUrl: "https://api.spotify.com/v1/",
            authorizationUrl: "https://accounts.spotify.com/authorize",
            tokenUrl: "https://accounts.spotify.com/api/token",
            redirectPath: "/",
            scopes: "user-read-private user-read-email playlist-read-private playlist-read-collaborative",
            endpoints: Object.freeze({
                search(query, types = "track,artist,album,playlist", limit = 6, market = "BR") {
                    return `search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(types)}&limit=${limit}&market=${encodeURIComponent(market)}`;
                },
                artist(id) {
                    return `artists/${encodeURIComponent(id)}`;
                },
                artistTopTracks(id, market = "BR") {
                    return `artists/${encodeURIComponent(id)}/top-tracks?market=${encodeURIComponent(market)}`;
                },
                artistAlbums(id, includeGroups = "album,single", market = "BR", limit = 10) {
                    return `artists/${encodeURIComponent(id)}/albums?include_groups=${encodeURIComponent(includeGroups)}&market=${encodeURIComponent(market)}&limit=${limit}`;
                },
                album(id, market = "BR") {
                    return `albums/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`;
                },
                albumTracks(id, market = "BR", limit = 50) {
                    return `albums/${encodeURIComponent(id)}/tracks?market=${encodeURIComponent(market)}&limit=${limit}`;
                },
                playlist(id, market = "BR") {
                    return `playlists/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`;
                },
                track(id, market = "BR") {
                    return `tracks/${encodeURIComponent(id)}?market=${encodeURIComponent(market)}`;
                }
            })
        })
    }),
    serverRoutes: Object.freeze({
        configuration: "/api/config"
    }),
    playback: Object.freeze({
        deezerPreviewOnly: true,
        allowUnlicensedStreamExtraction: false
    })
});

if (typeof module !== "undefined" && module.exports) {
    module.exports = API_CONFIG;
}
if (typeof window !== "undefined") {
    window.API_CONFIG = API_CONFIG;
}
