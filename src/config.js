/**
 * [PT] Centralização de endpoints públicos e configurações do Open Music Hub.
 * [EN] Centralization of public endpoints and Open Music Hub configurations.
 * 
 * [PT] IMPORTANTE: Este arquivo NÃO deve conter chaves privadas, tokens ou credenciais.
 * [EN] IMPORTANT: This file MUST NOT contain private keys, tokens or credentials.
 * 
 * [PT] Todas as APIs aqui são públicas ou roteadas pelo servidor próprio.
 * [EN] All APIs here are public or routed through the own server.
 */

const API_CONFIG = {
    // [PT] Servidor local / rotas próprias / [EN] Local server / own routes
    server: {
        baseUrl: ""
    },
    
    // [PT] Provedores musicais públicos / [EN] Public music providers
    providers: {
        // [PT] Deezer API - catálogo musical público / [EN] Deezer API - public music catalog
        deezer: {
            baseUrl: "https://api.deezer.com",
            endpoints: {
                search: (type, query) => `/search/${type}?q=${encodeURIComponent(query)}`,
                artist: (id) => `/artist/${id}`,
                artistTopTracks: (id) => `/artist/${id}/top?limit=50`,
                artistAlbums: (id) => `/artist/${id}/albums?limit=100`,
                album: (id) => `/album/${id}`,
                albumTracks: (id) => `/album/${id}/tracks`,
                playlist: (id) => `/playlist/${id}`,
                playlistTracks: (id) => `/playlist/${id}/tracks`,
                track: (id) => `/track/${id}`
            },
            searchPath: (query) => `/api/deezer/search?q=${encodeURIComponent(query)}`,
            detailPath: (resource, id) => `/api/deezer/${resource}/${encodeURIComponent(id)}`
        },
        
        // [PT] TheAudioDB v1 - chave pública '123' / [EN] TheAudioDB v1 - public key '123'
        // [PT] ATENÇÃO: Chave pública de teste, não é credencial privada / [EN] WARNING: Public test key, not a private credential
        audioDb: {
            baseUrl: "https://www.theaudiodb.com/api/v1/json/123",
            endpoints: {
                searchArtist: (artist) => `/search.php?s=${encodeURIComponent(artist)}`,
                searchDiscography: (artist) => `/discography.php?s=${encodeURIComponent(artist)}`,
                searchDiscographyMB: (mbid) => `/discography-mb.php?i=${encodeURIComponent(mbid)}`,
                searchAlbum: (artist, album) => `/searchalbum.php?s=${encodeURIComponent(artist)}&a=${encodeURIComponent(album)}`,
                searchTrack: (artist, track) => `/searchtrack.php?s=${encodeURIComponent(artist)}&t=${encodeURIComponent(track)}`,
                lookupArtist: (id) => `/artist.php?i=${encodeURIComponent(id)}`,
                lookupArtistMB: (mbid) => `/artist-mb.php?i=${encodeURIComponent(mbid)}`,
                lookupArtistSocial: (id) => `/artist-social.php?i=${encodeURIComponent(id)}`,
                lookupAlbum: (id) => `/album.php?m=${encodeURIComponent(id)}`,
                lookupAlbumByAlbumId: (id) => `/album-track.php?m=${encodeURIComponent(id)}`,
                lookupAlbumMB: (mbid) => `/album-mb.php?i=${encodeURIComponent(mbid)}`,
                lookupTrackByAlbum: (id) => `/track.php?m=${encodeURIComponent(id)}`,
                lookupTrackById: (id) => `/track.php?h=${encodeURIComponent(id)}`,
                lookupTrackMB: (mbid) => `/track-mb.php?i=${encodeURIComponent(mbid)}`,
                musicVideos: (id) => `/mvid.php?i=${encodeURIComponent(id)}`,
                musicVideosMB: (mbid) => `/mvid-mb.php?i=${encodeURIComponent(mbid)}`,
                trackTop10: (artist) => `/track-top10.php?s=${encodeURIComponent(artist)}`,
                mostLovedTracks: "/mostloved.php?format=track",
                mostLovedAlbums: "/mostloved.php?format=album",
                trending: (country, type, format) => `/trending.php?country=${encodeURIComponent(country)}&type=${encodeURIComponent(type)}&format=${encodeURIComponent(format)}`
            },
            providerPath: (path) => `/api/audiodb${path.replace("?", "?action=")}`,
            searchArtistPath: (artist) => `/api/audiodb?action=search-artist&artist=${encodeURIComponent(artist)}`
        },
        
        // [PT] Invidious - streaming de áudio completo / [EN] Invidious - full audio streaming
        invidious: {
            baseUrl: "https://invidious.f5.si",
            engineTimeoutMs: 3000,
            endpoints: {
                search: (query) => `/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
                video: (id) => `/api/v1/videos/${encodeURIComponent(id)}`
            },
            searchPath: (query) => `/api/invidious/search?q=${encodeURIComponent(query)}`,
            detailRoutePrefix: "/api/invidious/videos/",
            detailPath: (id) => `/api/invidious/videos/${encodeURIComponent(id)}`,
            audioPath: "/api/invidious/audio",
            proxyBasePath: "/api/invidious/stream"
        },
        
        // [PT] Lyrics.ovh e LrcLib - letras sincronizadas / [EN] Lyrics.ovh and LrcLib - synced lyrics
        lyrics: {
            baseUrl: "https://api.lyrics.ovh/v1",
            lrclib: {
                baseUrl: "https://lrclib.net/api",
                lookupPath: (artist, title) => `/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`,
                userAgent: "OpenMusicHub/1.0"
            },
            searchPath: (artist, title) => `/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`,
            syncedSearchPath: (artist, title) => `/api/lyrics?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}&format=synced`
        },
        
        // [PT] Jamendo - música com licença CC / [EN] Jamendo - CC licensed music
        jamendo: {
            baseUrl: "https://api.jamendo.com/v3.0",
            endpoints: {
                search: (query) => `/tracks/?format=jsonpretty&limit=24&include=musicinfo+licenses&order=popularity_total&namesearch=${encodeURIComponent(query)}`
            },
            searchPath: (query) => `/api/jamendo/search?q=${encodeURIComponent(query)}`
        },
        
        // [PT] MusicBrainz - metadados adicionais / [EN] MusicBrainz - additional metadata
        musicBrainz: {
            baseUrl: "https://musicbrainz.org/ws/2",
            endpoints: {
                searchArtist: (name) => `/artist/?query=artist:${encodeURIComponent(name)}&fmt=json&limit=5`,
                artistReleases: (mbid) => `/release-group/?artist=${encodeURIComponent(mbid)}&type=album|ep&fmt=json&limit=25`
            },
            artistSearchPath: (name) => `/api/musicbrainz/artist?q=${encodeURIComponent(name)}`
        }
    }
};

export default API_CONFIG;

// [PT] Exportação para uso em Node.js e navegador / [EN] Export for Node.js and browser usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}

if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
}
