# Open Music Hub

Projeto open source para reunir busca, descoberta e reprodução de músicas em uma só interface. A aplicação combina catálogos públicos, biblioteca local e um player de navegador, sem afiliação com Spotify ou outro serviço.

## Recursos

- Busca agregada no Deezer e no Invidious, com debounce de 300 ms; Jamendo pode ser ativado como fonte opcional de faixas completas licenciadas.
- Spotify Web API opcional para metadados, mediante autenticação OAuth com PKCE.
- Biografia e imagens de artistas do TheAudioDB, discografia do MusicBrainz e letras via Lyrics.ovh.
- Páginas de artistas, faixas, álbuns e playlists.
- Aba **Novidades** para consultar lançamentos de artistas salvos.
- Player com reprodução de faixas completas a partir de vários arquivos de áudio locais selecionados pelo usuário; prévias do Deezer continuam disponíveis quando fornecidas. A seleção aceita apenas formatos de áudio.
- Integração opcional com Jamendo para faixas completas que tenham download permitido e licença compatível.
- Controles de fila, volume, busca por posição e salvamentos locais.
- Configuração dos provedores centralizada em `public/js/config.js`.

## Tecnologias

- HTML5 semântico.
- CSS3 responsivo e utilitários Tailwind CSS.
- JavaScript Vanilla com `async`/`await` e Fetch API.
- Node.js nativo para o servidor; Tailwind CSS é dependência apenas de desenvolvimento.

Os componentes continuam estilizados com CSS próprio; Tailwind fornece utilitários pontuais sem aplicar reset global, preservando o layout existente.

## Estrutura

```text
.
├── public/
│   ├── css/
│   │   ├── styles.css
│   │   └── tailwind.css
│   ├── index.html
│   ├── js/
│   │   ├── app.js
│   │   └── config.js
│   ├── privacy.html
│   ├── music/
│   │   ├── lil-giela-cristal.mp3
│   │   └── lil giela cristal.mp4
├── .env.example
├── .gitignore
├── api/
│   └── [...path].js
├── LICENSE
├── package.json
├── package-lock.json
├── README.md
├── src/
│   └── tailwind.css
├── server.js
├── tests/
│   ├── api-routes.test.mjs
│   └── playback.test.mjs
└── vercel.json
```

O servidor serve somente arquivos dentro de `public/`; configurações privadas e arquivos do projeto que ficam na raiz não são expostos como conteúdo estático.

## Executar localmente

Requisitos: Node.js 18 ou mais recente.

1. Clone o repositório e abra a pasta do projeto.
2. Instale as dependências de desenvolvimento e gere os utilitários CSS:

   ```sh
   npm install
   npm run build:css
   ```

3. Opcionalmente, copie `.env.example` para `.env` e configure os provedores necessários:

   ```env
   SPOTIFY_CLIENT_ID=
   JAMENDO_CLIENT_ID=
   GENIUS_ACCESS_TOKEN=
   MUSIXMATCH_API_KEY=
   ```

   `SPOTIFY_CLIENT_ID` é público. `JAMENDO_CLIENT_ID` habilita a busca Jamendo. A TheAudioDB usa a chave pública de teste `123`, centralizada em `public/js/config.js`, sem configuração no `.env`; essa chave tem limites e não deve ser tratada como credencial privada nem como garantia de disponibilidade. Genius e Musixmatch estão reservados para integração futura. Nunca coloque tokens ou segredos privados no `config.js`, no navegador ou no Git.
4. Inicie o servidor:

   ```sh
   npm start
   ```

5. Acesse [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

Não abra `public/index.html` diretamente pelo sistema de arquivos: as chamadas aos catálogos passam pelo servidor local para evitar problemas de CORS.

Para rodar os testes do resolvedor de áudio licenciado:

```sh
npm test
```

## Provedores e configuração

As URLs base, endpoints, rotas locais e parâmetros públicos ficam centralizados em [`public/js/config.js`](./public/js/config.js). Não adicione credenciais privadas nesse arquivo. `server.js` compartilha o handler HTTP entre execução local e a função serverless `api/[...path].js` da Vercel. Para manter compatibilidade com o roteamento de funções da Vercel, as APIs usam uma rota por provedor (por exemplo, `/api/deezer`) e diferenciam operações por parâmetros de consulta.

### Deezer

- [Documentação da Deezer API](https://developers.deezer.com/api); API pública em `https://api.deezer.com/`, sem autenticação.
- Fornece resultados de busca, metadados, capas e prévias de áudio quando disponíveis.
- A aba **Novidades** consulta os álbuns e singles dos artistas Deezer salvos.
- As prévias têm duração e disponibilidade limitadas pelo catálogo.

### Invidious

- A instância inicial está definida como `https://invidious.f5.si/` em `public/js/config.js` e pode ser trocada por outra instância pública ativa. Consulte [api.invidious.io](https://api.invidious.io) ou [instances.invidious.io](https://instances.invidious.io) para encontrar instâncias; disponibilidade e políticas variam.
- Fornece metadados de vídeos e links para a página oficial.
- O servidor filtra as respostas e não encaminha URLs de streams ou formatos adaptativos.

### TheAudioDB v1 e MusicBrainz

- A aplicação usa a [API v1 da TheAudioDB](https://www.theaudiodb.com/), com a chave pública de teste `123` e o prefixo `api/v1/json/123/`. A chave `2` não respondeu neste teste; a `123` respondeu para busca de artista. Esse acesso público está sujeito a limites e disponibilidade do provedor.
- `API_CONFIG.providers.audioDb.endpoints` centraliza os endpoints v1 de pesquisa de artista, discografia, álbum e faixa; lookup de artista/álbum/faixa por ID ou MusicBrainz ID; vídeos musicais; top 10; mais amados; e tendências. As chamadas do aplicativo passam por `/api/audiodb` no servidor, que monta o caminho contra a origem fixa do provedor e valida parâmetros, sem oferecer um proxy de URL arbitrária.
- A disponibilidade de cada endpoint pode variar conforme o plano e o estado do serviço. Em uma verificação recente, `search.php`, `discography.php`, `searchalbum.php`, `searchtrack.php`, `artist.php` e `trending.php` responderam com a chave `123`; os endpoints `mostloved.php` retornaram 404. Erros do provedor são expostos como falha, não convertidos em resultados inventados.
- [Documentação do MusicBrainz Web Service](https://musicbrainz.org/doc/Development/XML_Web_Service/Version_2): complementa perfis com dados de artistas e grupos de lançamento. Não exige chave; o servidor envia um `User-Agent` identificável e serializa as chamadas para respeitar o limite de uso.

### Lyrics.ovh

- [Documentação Lyrics.ovh](https://lyricsovh.docs.apiary.io/): letras são consultadas no endpoint público e apresentadas como texto, sem interpretar conteúdo externo como HTML.
- [Genius API Clients](https://genius.com/api-clients) e [Musixmatch Developer](https://developer.musixmatch.com/) exigem credenciais conforme as regras de cada serviço. As variáveis `GENIUS_ACCESS_TOKEN` e `MUSIXMATCH_API_KEY` estão reservadas no `.env.example`, mas esses provedores ainda não estão conectados nem são usados como fontes de letras.

### Jamendo (opcional)

1. Acesse a [documentação Jamendo API v3.0](https://developer.jamendo.com/v3.0), crie uma conta e registre um app em **My Apps > Create an App**.
2. Defina `JAMENDO_CLIENT_ID` no arquivo `.env` local e reinicie o servidor.
3. O Client ID permite consultar o catálogo, mas não concede direitos adicionais sobre as faixas. Os resultados só recebem URL de reprodução quando o serviço declara o download permitido, informa uma licença Creative Commons válida e fornece um stream HTTPS no domínio oficial do Jamendo.

Confira e respeite os termos de cada API e a licença indicada para cada faixa. O projeto não contorna controles de acesso nem remove restrições de direitos autorais.

### Audiomack e SoundCloud (não conectados)

- O [Audiomack Data API](https://www.audiomack.com/data-api) e a [documentação de desenvolvedores do SoundCloud](https://developers.soundcloud.com/) são referências para avaliar integrações futuras.
- Esta versão não chama essas APIs. Cadastro de uma aplicação ou obtenção de `API Key`, `API Secret` ou `client_id` não está implementado e não habilita reprodução no app.
- Antes de integrar, confirme que o acesso para novos aplicativos, endpoints e direitos de reprodução continuam disponíveis nos termos oficiais. Credenciais privadas, se vierem a ser necessárias, devem ser lidas pelo servidor a partir de `.env`, nunca adicionadas ao `config.js` público.

### Spotify (opcional)

O Spotify Web API é usado apenas para metadados e capas. Para habilitar:

1. Crie um app no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Cadastre `http://127.0.0.1:8765/` como Redirect URI.
3. Informe o Client ID público na configuração da aplicação ou em `SPOTIFY_CLIENT_ID` no `.env`.

A autenticação usa Authorization Code com PKCE; não use client secret no navegador. O Spotify Web API não fornece reprodução completa de músicas.

## Reprodução e uso autorizado

O player reproduz faixas completas a partir de arquivos de áudio escolhidos pelo usuário (é possível selecionar vários para criar uma fila local) e, quando configurado, faixas Jamendo com download permitido e licença identificável. Ao selecionar uma faixa Deezer ou Spotify, o app tenta primeiro encontrar uma correspondência exata de título e artista no Jamendo; se não encontrar, usa a prévia oficial disponível. Se essa prévia falhar, tenta novamente uma faixa completa licenciada. Resultados do Invidious e metadados do Spotify podem abrir suas páginas oficiais, mas não são convertidos em áudio pelo projeto. O projeto não extrai streams completos do Invidious/YouTube.

## Deploy na Vercel

1. Envie este repositório ao GitHub e importe-o no painel da [Vercel](https://vercel.com/new).
2. Mantenha o diretório raiz do projeto e o preset **Other**. O `vercel.json` executa `npm install` e `npm run build`, publica `public/` e aplica cabeçalhos HTTP básicos de segurança; a Vercel detecta a função em `api/[...path].js`.
3. Configure no projeto Vercel somente as variáveis dos provedores que pretende habilitar, em **Settings > Environment Variables**, e faça um novo deploy:
   - `JAMENDO_CLIENT_ID` (opcional, gratuito conforme cadastro/termos do provedor) habilita faixas Jamendo elegíveis.
   - `SPOTIFY_CLIENT_ID` (opcional) habilita metadados Spotify; configure também a URL pública do site como Redirect URI no Spotify Developer Dashboard.
   - TheAudioDB usa a chave pública de teste `123` para v1, sem variável de ambiente. Esse acesso pode ser limitado ou descontinuado pelo provedor.
4. Não envie um arquivo `.env` para o repositório ou para os arquivos estáticos; cadastre as variáveis no painel. `.vercel/` e arquivos `.env` estão ignorados pelo Git.

O deploy da interface e das rotas serverless não transforma arquivos selecionados pelo usuário em armazenamento persistente. O armazenamento da biblioteca e das contagens é local ao navegador. Antes de publicar qualquer arquivo em `public/music/`, confirme que você tem autorização para distribuí-lo publicamente.

## Segurança

- `.env`, diretórios de segredos e arquivos de chaves locais estão no `.gitignore`; `.env.example` é o único arquivo de ambiente versionado.
- O servidor escuta em `127.0.0.1` por padrão e restringe arquivos estáticos à pasta `public/`.
- `public/js/config.js` contém somente endpoints e opções públicas. Nunca cole tokens ou segredos no exemplo de configuração do navegador.
- Client IDs podem ser públicos quando o provedor assim os define; tokens, API secrets e outras credenciais privadas devem ficar no `.env` local e não devem ser adicionados ao repositório.
- Não reutilize chaves compartilhadas em conversas ou commits. Revogue-as junto ao provedor quando necessário.

### Privacidade e LGPD

- Consulte [`public/privacy.html`](./public/privacy.html) para o aviso de privacidade apresentado pela aplicação.
- O app mantém biblioteca, estatísticas e Client ID público no armazenamento local do navegador; o fluxo Spotify usa estado PKCE temporário de sessão. Arquivos escolhidos no player não são enviados pelo app.
- Termos de busca são encaminhados a provedores externos; a Vercel e os provedores podem processar logs técnicos, como IP e dados de requisição, conforme seus próprios termos.
- **Antes do deploy público**, substitua o campo de contato pendente no aviso por um canal privado válido do responsável e confirme com os provedores ativos as finalidades, bases legais, transferências internacionais e prazos de retenção aplicáveis. O aviso é informativo e não substitui validação jurídica.

## Próximas evoluções

- Adicionar testes automatizados para os normalizadores, rotas e controles do player.
- Avaliar uma integração de catálogo alternativa, como a iTunes Search API, como fallback.
- Ampliar as verificações automatizadas de acessibilidade.
- Permitir escolher e monitorar várias instâncias de metadados disponíveis.

## Licença

Distribuído sob a licença MIT. Consulte [`LICENSE`](./LICENSE).
