
# PM2 API Server

Este servidor fornece uma API REST para interagir com o PM2 em um ambiente de produção. A API é protegida por autenticação baseada em token e permite gerenciar processos PM2 remotamente.

## Instalação

1. Instale as dependências:
   ```
   npm install express cors pm2 dotenv
   ```

2. Crie um arquivo `.env` na raiz do projeto:
   ```
   PORT=3000
   PM2_API_KEY=sua-chave-api-secreta
   ```

3. Inicie o servidor:
   ```
   node pm2-api-server.js
   ```

## Endpoints da API

### Listar todos os processos
```
GET /processes
```

### Obter status de um processo específico
```
GET /processes/:name/status
```

### Iniciar um processo
```
POST /processes/:name/start
```
Body (opcional):
```json
{
  "script": "caminho/para/script.js",
  "env": {
    "NODE_ENV": "production",
    "KEY": "value"
  }
}
```

### Parar um processo
```
POST /processes/:name/stop
```

### Reiniciar um processo
```
POST /processes/:name/restart
```

### Obter logs de um processo
```
GET /processes/:name/logs?lines=100
```

### Atualizar variáveis de ambiente de um processo
```
POST /processes/:name/env
```
Body:
```json
{
  "env": {
    "KEY1": "value1",
    "KEY2": "value2"
  }
}
```

## Autenticação

Todas as solicitações à API devem incluir um cabeçalho de autorização com o token de API:

```
Authorization: Bearer seu-token-api
```

## Segurança

- Configure o servidor atrás de um proxy reverso HTTPS como Nginx para criptografia SSL.
- Use um token de API forte e único.
- Limite o acesso ao servidor por IP ou rede, se possível.
