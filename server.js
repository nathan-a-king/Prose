
import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { documentDb } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 8080

// Determine build directory based on environment
const isPackaged = __dirname.includes('app.asar')
let buildPath;

if (isPackaged) {
  // In packaged app, build files are unpacked
  // __dirname is already in the .unpacked directory when running
  buildPath = path.join(__dirname, 'build')
} else {
  buildPath = path.join(__dirname, 'build')
}

console.log('Build path:', buildPath)

// Middleware
app.use(express.json())
app.use(express.static(buildPath))

// AI Proxy Routes - Forward requests to OpenAI API
app.post('/api/ai/completion', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key']
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' })
    }

    const { model = 'gpt-4o', messages, temperature = 0.7, max_tokens = 4000, response_format } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' })
    }

    const requestBody = { model, messages, temperature, max_tokens }
    if (response_format) {
      requestBody.response_format = response_format
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return res.status(response.status).json({
        error: errorData.error?.message || 'OpenAI API error'
      })
    }

    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.error('AI completion error:', error)
    res.status(500).json({ error: 'Failed to process AI request' })
  }
})

app.post('/api/ai/completion/stream', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key']
    if (!apiKey) {
      return res.status(400).json({ error: 'API key required' })
    }

    const { model = 'gpt-4o', messages, temperature = 0.7, max_tokens = 4000 } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens, stream: true })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return res.status(response.status).json({
        error: errorData.error?.message || 'OpenAI API error'
      })
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // Pipe the stream directly to the client
    response.body.pipe(res)

    // Handle client disconnect
    req.on('close', () => {
      response.body.destroy()
    })
  } catch (error) {
    console.error('AI streaming error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process AI streaming request' })
    }
  }
})

// API Routes
app.get('/api/documents', (req, res) => {
  try {
    const documents = documentDb.getAll()
    res.json(documents)
  } catch (error) {
    console.error('Error fetching documents:', error)
    res.status(500).json({ error: 'Failed to fetch documents' })
  }
})

// Update document order - must come before :id route
app.put('/api/documents/order', (req, res) => {
  try {
    const { documentOrders } = req.body
    if (!Array.isArray(documentOrders)) {
      return res.status(400).json({ error: 'Document orders must be an array' })
    }
    
    const updated = documentDb.updateOrder(documentOrders)
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update document order' })
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating document order:', error)
    res.status(500).json({ error: 'Failed to update document order' })
  }
})

app.get('/api/documents/:id', (req, res) => {
  try {
    const document = documentDb.getById(req.params.id)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }
    res.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    res.status(500).json({ error: 'Failed to fetch document' })
  }
})

app.post('/api/documents', (req, res) => {
  try {
    const { title, content, preview, titleManuallySet } = req.body
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' })
    }
    
    const documentId = documentDb.create(title, content, preview || '', titleManuallySet || false)
    const document = documentDb.getById(documentId)
    res.status(201).json(document)
  } catch (error) {
    console.error('Error creating document:', error)
    res.status(500).json({ error: 'Failed to create document' })
  }
})

app.put('/api/documents/:id', (req, res) => {
  try {
    const { title, content, preview, titleManuallySet } = req.body
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' })
    }
    
    const updated = documentDb.update(req.params.id, title, content, preview || '', titleManuallySet || false)
    if (!updated) {
      return res.status(404).json({ error: 'Document not found' })
    }
    
    const document = documentDb.getById(req.params.id)
    res.json(document)
  } catch (error) {
    console.error('Error updating document:', error)
    res.status(500).json({ error: 'Failed to update document' })
  }
})

app.delete('/api/documents/:id', (req, res) => {
  try {
    const deleted = documentDb.delete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' })
    }
    res.status(204).send()
  } catch (error) {
    console.error('Error deleting document:', error)
    res.status(500).json({ error: 'Failed to delete document' })
  }
})

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})