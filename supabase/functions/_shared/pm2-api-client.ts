
// Cliente para interagir com a API PM2 real em produção
export class PM2ApiClient {
  private baseUrl: string
  private apiKey: string
  
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }
  
  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    const options: RequestInit = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    }
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`PM2 API Error (${response.status}): ${errorText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error(`PM2 API Request Error: ${error.message}`)
      throw error
    }
  }
  
  // Métodos para interagir com a API PM2 real
  
  async listProcesses() {
    return this.request('/processes')
  }
  
  async getProcessStatus(processName: string) {
    return this.request(`/processes/${processName}/status`)
  }
  
  async startProcess(processName: string, options?: { env?: Record<string, string> }) {
    return this.request(`/processes/${processName}/start`, 'POST', options)
  }
  
  async stopProcess(processName: string) {
    return this.request(`/processes/${processName}/stop`, 'POST')
  }
  
  async restartProcess(processName: string) {
    return this.request(`/processes/${processName}/restart`, 'POST')
  }
  
  async getLogs(processName: string, options?: { lines?: number }) {
    return this.request(`/processes/${processName}/logs${options?.lines ? `?lines=${options.lines}` : ''}`)
  }
  
  async setEnv(processName: string, env: Record<string, string>) {
    return this.request(`/processes/${processName}/env`, 'POST', { env })
  }
}
