# Open Music Hub

Projeto open source para reunir busca, descoberta e reprodução de músicas em uma só interface. A aplicação combina catálogos públicos, biblioteca local e um player de navegador, sem afiliação com Spotify ou outro serviço.

## Recursos

- Busca agregada no Deezer e no Invidious, com debounce de 300 ms.
- Spotify Web API opcional para metadados, mediante autenticação OAuth com PKCE.
- Páginas de artistas, faixas, álbuns e playlists.
- Aba **Novidades** para consultar lançamentos de artistas salvos.
- Player com reprodução de faixas completas a partir de vários arquivos de áudio locais selecionados pelo usuário; prévias do Deezer continuam disponíveis quando fornecidas.
- Controles de fila, volume, busca por posição e salvamentos locais.
- Configuração dos provedores centralizada em `public/js/config.js`.

## Tecnologias

- HTML5 semântico.
- CSS3 responsivo.
- JavaScript Vanilla com `async`/`await` e Fetch API.
- Node.js nativo, sem dependências de runtime.

O estilo atual usa CSS próprio, não Tailwind CSS. A configuração de Tailwind e um processo de build podem ser adicionados em uma evolução futura, sem alterar a separação entre aplicação pública e servidor.

## Estrutura

```text
.
├── public/
│   ├── css/
│   │   └── styles.css
│   ├── index.html
│   ├── js/
│   │   ├── app.js
│   │   └── config.js
│   ├── music/
│   │   ├── lil-giela-cristal.mp3
│   │   └── lil giela cristal.mp4
├── .env.example
├── .gitignore
├── LICENSE
├── README.md
└── server.js
```

O servidor serve somente arquivos dentro de `public/`; configurações privadas e arquivos do projeto que ficam na raiz não são expostos como conteúdo estático.

## Executar localmente

Requisitos: Node.js 18 ou mais recente.

1. Clone o repositório e abra a pasta do projeto.
2. Opcionalmente, copie `.env.example` para `.env` e informe um `SPOTIFY_CLIENT_ID` público.
3. Inicie o servidor:

   ```sh
   node server.js
   ```

4. Acesse [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

Não abra `public/index.html` diretamente pelo sistema de arquivos: as chamadas aos catálogos passam pelo servidor local para evitar problemas de CORS.

## Provedores e configuração

As URLs base, endpoints, rotas locais e parâmetros ficam centralizados em [`public/js/config.js`](./public/js/config.js). Não adicione credenciais privadas nesse arquivo.

### Deezer

- API pública: `https://api.deezer.com/`, sem autenticação.
- Fornece resultados de busca, metadados, capas e prévias de áudio quando disponíveis.
- A aba **Novidades** consulta os álbuns e singles dos artistas Deezer salvos.
- As prévias têm duração e disponibilidade limitadas pelo catálogo.

### Invidious

- A instância inicial está definida em `public/js/config.js` e pode ser trocada por outra instância pública ativa.
- Fornece metadados de vídeos e links para a página oficial.
- O servidor filtra as respostas e não encaminha URLs de streams ou formatos adaptativos.

### Spotify (opcional)

O Spotify Web API é usado apenas para metadados e capas. Para habilitar:

1. Crie um app no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Cadastre `http://127.0.0.1:8765/` como Redirect URI.
3. Informe o Client ID público na configuração da aplicação ou em `SPOTIFY_CLIENT_ID` no `.env`.

A autenticação usa Authorization Code com PKCE; não use client secret no navegador. O Spotify Web API não fornece reprodução completa de músicas.

## Reprodução e uso autorizado

O player reproduz faixas completas a partir de arquivos de áudio escolhidos pelo usuário (é possível selecionar vários para criar uma fila local) e prévias fornecidas pelo Deezer. Resultados do Invidious e metadados do Spotify podem abrir suas páginas oficiais, mas não são convertidos em áudio pelo projeto. Para ouvir músicas completas, importe arquivos que você tenha direito de reproduzir ou use serviços oficiais que autorizem essa integração. O projeto não extrai streams completos do Invidious/YouTube.

## Segurança

- `.env`, diretórios de segredos e arquivos de chaves locais estão no `.gitignore`; `.env.example` é o único arquivo de ambiente versionado.
- O servidor escuta em `127.0.0.1` por padrão e restringe arquivos estáticos à pasta `public/`.
- O Client ID do Spotify é público; tokens e client secrets não devem ser adicionados ao repositório.
- Não reutilize chaves compartilhadas em conversas ou commits. Revogue-as junto ao provedor quando necessário.

## Próximas evoluções

- Adicionar testes automatizados para os normalizadores, rotas e controles do player.
- Avaliar uma integração de catálogo alternativa, como a iTunes Search API, como fallback.
- Adicionar build opcional com Tailwind CSS e verificações automatizadas de acessibilidade.
- Permitir escolher e monitorar várias instâncias de metadados disponíveis.

## Licença

Distribuído sob a licença MIT. Consulte [`LICENSE`](./LICENSE).
