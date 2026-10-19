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
                return `${this.proxyBasePath}?action=search&q=${encodeURIComponent(query)}`;
            },
            detailPath(kind, id) {
                return `${this.proxyBasePath}?action=detail&resource=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
            },
            artistAlbumsPath(id) {
                return `${this.proxyBasePath}?action=artist-albums&id=${encodeURIComponent(id)}`;
            }
        }),
        // V2 credentials are configured only on the server and never exposed in this public file.
        // As credenciais V2 são configuradas somente no servidor e nunca expostas neste arquivo público.
        audioDb: Object.freeze({
            baseUrl: "https://www.theaudiodb.com/",
            apiPath: "api/v2/json/",
            apiKeyEnvironmentVariable: "AUDIODB_API_KEY",
            proxyBasePath: "/api/audiodb",
            get searchRoute() {
                return `${this.proxyBasePath}/search`;
            },
            get lookupRoute() {
                return `${this.proxyBasePath}/lookup`;
            },
            get discographyRoute() {
                return `${this.proxyBasePath}/discography`;
            },
            artistSearchPath(name) {
                return `${this.proxyBasePath}?action=search&kind=artist&q=${encodeURIComponent(name)}`;
            },
            searchPath(kind, query) {
                return `${this.proxyBasePath}?action=search&kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(query)}`;
            },
            lookupPath(kind, id, musicBrainz = false) {
                const lookupKind = musicBrainz ? `${kind}_mb` : kind;
                return `${this.proxyBasePath}?action=lookup&kind=${encodeURIComponent(lookupKind)}&id=${encodeURIComponent(id)}`;
            },
            discographyPath(artistId) {
                return `${this.proxyBasePath}?action=discography&id=${encodeURIComponent(artistId)}`;
            },
            endpoints: Object.freeze({
                search: Object.freeze({
                    artist(name) {
                        return `search/artist/${encodeURIComponent(name)}`;
                    },
                    album(name) {
                        return `search/album/${encodeURIComponent(name)}`;
                    },
                    track(name) {
                        return `search/track/${encodeURIComponent(name)}`;
                    }
                }),
                lookup: Object.freeze({
                    artist(id) {
                        return `lookup/artist/${encodeURIComponent(id)}`;
                    },
                    artistByMusicBrainz(mbid) {
                        return `lookup/artist_mb/${encodeURIComponent(mbid)}`;
                    },
                    album(id) {
                        return `lookup/album/${encodeURIComponent(id)}`;
                    },
                    albumByMusicBrainz(mbid) {
                        return `lookup/album_mb/${encodeURIComponent(mbid)}`;
                    },
                    track(id) {
                        return `lookup/track/${encodeURIComponent(id)}`;
                    },
                    trackByMusicBrainz(mbid) {
                        return `lookup/track_mb/${encodeURIComponent(mbid)}`;
                    }
                }),
                list: Object.freeze({
                    discography(artistId) {
                        return `list/discography/${encodeURIComponent(artistId)}`;
                    }
                })
            }),
            providerPath(resourcePath) {
                return `${this.apiPath}${resourcePath}`;
            },
            providerSearchPath(kind, query) {
                return this.providerPath(this.endpoints.search[kind](query));
            },
            providerLookupPath(kind, id, musicBrainz = false) {
                const endpoint = musicBrainz
                    ? this.endpoints.lookup[`${kind}ByMusicBrainz`](id)
                    : this.endpoints.lookup[kind](id);
                return this.providerPath(endpoint);
            },
            providerDiscographyPath(artistId) {
                return this.providerPath(this.endpoints.list.discography(artistId));
            }
        }),
        musicBrainz: Object.freeze({
            baseUrl: "https://musicbrainz.org/ws/2/",
            proxyBasePath: "/api/musicbrainz",
            get artistSearchRoute() {
                return `${this.proxyBasePath}/artist`;
            },
            artistSearchPath(name) {
                return `${this.proxyBasePath}?q=${encodeURIComponent(name)}`;
            },
            endpoints: Object.freeze({
                searchArtist(name) {
                    return `artist/?query=${encodeURIComponent(`artist:"${name}"`)}&fmt=json&limit=1`;
                },
                artistReleases(mbid) {
                    return `release-group?artist=${encodeURIComponent(mbid)}&type=album|ep|single&fmt=json&limit=25`;
                }
            })
        }),
        lyrics: Object.freeze({
            baseUrl: "https://api.lyrics.ovh/v1/",
            proxyPath: "/api/lyrics",
            searchPath(artist, title) {
                return `${this.proxyPath}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
            },
            genius: Object.freeze({
                baseUrl: "https://api.genius.com/",
                search(query) {
                    return `search?q=${encodeURIComponent(query)}`;
                },
                accessTokenEnvironmentVariable: "GENIUS_ACCESS_TOKEN"
            }),
            musixmatch: Object.freeze({
                baseUrl: "https://api.musixmatch.com/ws/1.1/",
                trackSearch(query) {
                    return `track.search?q_track=${encodeURIComponent(query)}`;
                },
                apiKeyEnvironmentVariable: "MUSIXMATCH_API_KEY"
            })
        }),
        jamendo: Object.freeze({
            baseUrl: "https://api.jamendo.com/v3.0/",
            proxyBasePath: "/api/jamendo",
            get searchRoute() {
                return `${this.proxyBasePath}/search`;
            },
            searchPath(query) {
                return `${this.proxyBasePath}?q=${encodeURIComponent(query)}`;
            },
            endpoints: Object.freeze({
                search(query) {
                    return `tracks/?format=json&namesearch=${encodeURIComponent(query)}&limit=12&audioformat=mp32&include=musicinfo`;
                }
            })
        }),
        invidious: Object.freeze({
            baseUrl: "https://invidious.f5.si/",
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
                return `${this.proxyBasePath}?action=search&q=${encodeURIComponent(query)}`;
            },
            detailPath(videoId) {
                return `${this.proxyBasePath}?action=video&id=${encodeURIComponent(videoId)}`;
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
