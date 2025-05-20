
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { corsHeaders } from '../_shared/cors.ts'
import { PM2ApiClient } from '../_shared/pm2-api-client.ts'

// Define a URL da sua API PM2 em produção
const PM2_API_URL = Deno.env.get('PM2_API_URL') || 'https://your-production-server.com/api/pm2'
const PM2_API_KEY = Deno.env.get('PM2_API_KEY') || 'your-api-key'

const client = new PM2ApiClient(PM2_API_URL, PM2_API_KEY)

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Configuração do Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Obter os dados da requisição
    const { action, config, moduleData } = await req.json()
    
    // Log da ação recebida para monitoramento
    console.log(`Action received: ${action}`)
    
    // Switch para lidar com diferentes ações
    switch (action) {
      case 'start': {
        // Start bot using real PM2
        console.log(`Starting profiter-two bot with config:`, config)
        
        // Log no banco de dados que o bot está iniciando
        await supabase.from('bot_logs').insert({
          level: 'info',
          message: 'Starting profiter-two bot via PM2 API',
          category: 'bot_state',
          bot_type: 'profiter-two',
          source: 'system',
          metadata: { config }
        })
        
        // Chama a API PM2 real para iniciar o bot
        const result = await client.startProcess('profiter-two', {
          env: {
            NODE_ENV: 'production',
            BASE_TOKEN: config?.baseToken?.address || '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
            PROFIT_THRESHOLD: config?.profitThreshold?.toString() || '0.01',
            GAS_MULTIPLIER: config?.gasMultiplier?.toString() || '1.2',
            MAX_GAS_PRICE: config?.maxGasPrice?.toString() || '30'
          }
        })
        
        // Atualiza o status do bot no banco de dados
        await supabase
          .from('bot_statistics')
          .update({ is_running: true, updated_at: new Date().toISOString() })
          .eq('bot_type', 'profiter-two')
        
        return new Response(
          JSON.stringify({ success: true, status: 'started', result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'stop': {
        console.log(`Stopping profiter-two bot`)
        
        // Log no banco de dados que o bot está parando
        await supabase.from('bot_logs').insert({
          level: 'info',
          message: 'Stopping profiter-two bot via PM2 API',
          category: 'bot_state',
          bot_type: 'profiter-two',
          source: 'system'
        })
        
        // Chama a API PM2 real para parar o bot
        const result = await client.stopProcess('profiter-two')
        
        // Atualiza o status do bot no banco de dados
        await supabase
          .from('bot_statistics')
          .update({ is_running: false, updated_at: new Date().toISOString() })
          .eq('bot_type', 'profiter-two')
        
        return new Response(
          JSON.stringify({ success: true, status: 'stopped', result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'pm2Status': {
        console.log(`Checking PM2 status for profiter-two bot`)
        
        // Consulta o status real do PM2 através da API
        const status = await client.getProcessStatus('profiter-two')
        
        return new Response(
          JSON.stringify({ success: true, status: status?.status || 'unknown', details: status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'pm2Logs': {
        console.log(`Getting PM2 logs for profiter-two bot`)
        
        // Obtém os logs do PM2 através da API
        const logs = await client.getLogs('profiter-two', { lines: 100 })
        
        return new Response(
          JSON.stringify({ success: true, logs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'pm2Restart': {
        console.log(`Restarting profiter-two bot`)
        
        // Log no banco de dados que o bot está reiniciando
        await supabase.from('bot_logs').insert({
          level: 'info',
          message: 'Restarting profiter-two bot via PM2 API',
          category: 'bot_state',
          bot_type: 'profiter-two',
          source: 'system'
        })
        
        // Reinicia o processo através da API PM2
        const result = await client.restartProcess('profiter-two')
        
        return new Response(
          JSON.stringify({ success: true, status: 'restarted', result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'updateConfig': {
        console.log(`Updating configuration for profiter-two bot:`, config)
        
        // Atualiza a configuração do bot através da API PM2
        // Isso pode envolver reconfigurar o ambiente ou reiniciar o processo
        await client.setEnv('profiter-two', {
          BASE_TOKEN: config?.baseToken?.address || '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
          PROFIT_THRESHOLD: config?.profitThreshold?.toString() || '0.01',
          GAS_MULTIPLIER: config?.gasMultiplier?.toString() || '1.2',
          MAX_GAS_PRICE: config?.maxGasPrice?.toString() || '30'
        })
        
        // Log da atualização de configuração
        await supabase.from('bot_logs').insert({
          level: 'info',
          message: 'Configuration updated for profiter-two bot',
          category: 'configuration',
          bot_type: 'profiter-two',
          source: 'system',
          metadata: { config }
        })
        
        return new Response(
          JSON.stringify({ success: true, message: 'Configuration updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      case 'reportModuleStatus': {
        // Implementação para relatar status do módulo no DB
        if (moduleData) {
          await supabase.from('bot_logs').insert({
            level: moduleData.silent_errors?.length > 0 ? 'warn' : 'info',
            message: `Module ${moduleData.module} status: ${moduleData.status}`,
            category: 'health_check',
            bot_type: 'profiter-two',
            source: moduleData.module,
            metadata: moduleData
          })
          
          return new Response(
            JSON.stringify({ success: true, message: 'Module status reported' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          throw new Error('Missing module data')
        }
      }
      
      default:
        throw new Error(`Unsupported action: ${action}`)
    }
  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
