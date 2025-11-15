type Resp = { data: any }

const api = {
  async post(url: string, body: any): Promise<Resp> {
    if (url === '/api/ai/chat-stream') {
      const msg = typeof body?.message === 'string' ? body.message : ''
      const output = msg
        ? `模拟回复：你说“${msg}”，我已记录。`
        : '模拟回复：你好，我能帮你做很多事～'
      return Promise.resolve({ data: { output } })
    }
    return Promise.resolve({ data: {} })
  },
}

export default api

