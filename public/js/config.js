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
        audioDb: Object.freeze({
            baseUrl: "https://www.theaudiodb.com/",
            apiVersionPath: "api/v1/json/",
            // TheAudioDB's published test key is public and is not a private credential.
            testApiKey: "123",
            proxyBasePath: "/api/audiodb",
            get apiPath() {
                return `${this.apiVersionPath}${this.testApiKey}/`;
            },
            proxyPath(action, params = {}) {
                const query = new URLSearchParams({ action, ...params });
                return `${this.proxyBasePath}?${query}`;
            },
            artistSearchPath(name) {
                return this.proxyPath("search-artist", { artist: name });
            },
            searchPath(kind, artist, title = "") {
                if (kind === "artist") {
                    return this.artistSearchPath(artist);
                }
                if (kind === "album") {
                    return this.proxyPath("search-album", { artist, album: title });
                }
                if (kind === "track") {
                    return this.proxyPath("search-track", { artist, track: title });
                }
                throw new TypeError("Unsupported TheAudioDB search type.");
            },
            lookupPath(kind, id, musicBrainz = false) {
                const action = musicBrainz
                    ? `lookup-${kind}-mb`
                    : `lookup-${kind}`;
                return this.proxyPath(action, { id });
            },
            artistSocialPath(id) {
                return this.proxyPath("lookup-artist-social", { id });
            },
            albumByAlbumIdPath(id) {
                return this.proxyPath("lookup-album-by-album-id", { id });
            },
            trackByAlbumPath(id) {
                return this.proxyPath("lookup-track-by-album", { id });
            },
            trackByIdPath(id) {
                return this.proxyPath("lookup-track-by-id", { id });
            },
            discographyPath(artist) {
                return this.proxyPath("search-discography", { artist });
            },
            discographyByMusicBrainzPath(mbid) {
                return this.proxyPath("search-discography-mb", { mbid });
            },
            musicVideosPath(id, musicBrainz = false) {
                return this.proxyPath(musicBrainz ? "music-videos-mb" : "music-videos", { id });
            },
            trackTop10Path(artist) {
                return this.proxyPath("track-top10", { artist });
            },
            mostLovedTracksPath() {
                return this.proxyPath("most-loved-tracks");
            },
            mostLovedAlbumsPath() {
                return this.proxyPath("most-loved-albums");
            },
            trendingPath(country = "us", type = "itunes", format = "albums") {
                return this.proxyPath("trending", { country, type, format });
            },
            endpoints: Object.freeze({
                searchArtist(artist) {
                    return `search.php?s=${encodeURIComponent(artist)}`;
                },
                searchDiscography(artist) {
                    return `discography.php?s=${encodeURIComponent(artist)}`;
                },
                searchDiscographyMB(mbid) {
                    return `discography-mb.php?s=${encodeURIComponent(mbid)}`;
                },
                searchAlbum(artist, album) {
                    return `searchalbum.php?s=${encodeURIComponent(artist)}&a=${encodeURIComponent(album)}`;
                },
                searchTrack(artist, track) {
                    return `searchtrack.php?s=${encodeURIComponent(artist)}&t=${encodeURIComponent(track)}`;
                },
                lookupArtist(id) {
                    return `artist.php?i=${encodeURIComponent(id)}`;
                },
                lookupArtistMB(mbid) {
                    return `artist-mb.php?i=${encodeURIComponent(mbid)}`;
                },
                lookupArtistSocial(id) {
                    return `artist-social.php?i=${encodeURIComponent(id)}`;
                },
                lookupAlbum(id) {
                    return `album.php?i=${encodeURIComponent(id)}`;
                },
                lookupAlbumByAlbumId(albumId) {
                    return `album.php?m=${encodeURIComponent(albumId)}`;
                },
                lookupAlbumMB(mbid) {
                    return `album-mb.php?i=${encodeURIComponent(mbid)}`;
                },
                lookupTrackByAlbum(albumId) {
                    return `track.php?m=${encodeURIComponent(albumId)}`;
                },
                lookupTrackById(trackId) {
                    return `track.php?h=${encodeURIComponent(trackId)}`;
                },
                lookupTrackMB(mbid) {
                    return `track-mb.php?i=${encodeURIComponent(mbid)}`;
                },
                musicVideos(artistId) {
                    return `mvid.php?i=${encodeURIComponent(artistId)}`;
                },
                musicVideosMB(mbid) {
                    return `mvid-mb.php?i=${encodeURIComponent(mbid)}`;
                },
                trackTop10(artist) {
                    return `track-top10.php?s=${encodeURIComponent(artist)}`;
                },
                mostLovedTracks: "mostloved.php?format=track",
                mostLovedAlbums: "mostloved.php?format=album",
                trending(country = "us", type = "itunes", format = "albums") {
                    const params = new URLSearchParams({ country, type, format });
                    return `trending.php?${params}`;
                }
            }),
            providerPath(resourcePath) {
                return `${this.apiPath}${resourcePath}`;
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
            // Letra sincronizada (LRC) pelo LrcLib, com fallback para o Lyrics.ovh.
            // Time-synced lyrics (LRC) through LrcLib, falling back to Lyrics.ovh.
            syncedPath(artist, title) {
                return `${this.proxyPath}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&format=synced`;
            },
            // LrcLib é consultado somente pelo proxy da mesma origem.
            // LrcLib is only queried through the same-origin proxy.
            lrclib: Object.freeze({
                baseUrl: "https://lrclib.net/api/get",
                userAgent: "OpenMusicHub/1.0",
                lookupPath(artist, title) {
                    return `?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
                }
            }),
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
            },
            proxyPath(action, params = {}) {
                const query = new URLSearchParams({ action, ...params });
                return `${this.proxyBasePath}?${query}`;
            },
            // A qualidade é opcional para não quebrar chamadas antigas sem preferência.
            // Quality is optional so older callers without a preference keep working.
            audioPath(videoId, quality = "") {
                return this.proxyPath("audio", quality ? { id: videoId, quality } : { id: videoId });
            },
            streamPath(videoId) {
                return this.proxyPath("stream", { id: videoId });
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
