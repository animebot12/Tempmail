// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Keys and Services
const API_SERVICES = {
    JUHE: {
        name: 'Juhe API',
        baseURL: 'https://hub.juheapi.com/temp-mail/v1',
        apiKey: '434306d581f376e3aa290e7c7df966fc'
    },
    ONESECMAIL: {
        name: '1SecMail',
        baseURL: 'https://www.1secmail.com/api/v1'
    },
    TEMPMAIL: {
        name: 'TempMail',
        baseURL: 'https://api.temp-mail.io/api/v1'
    }
};

// Generate random email
function generateRandomEmail() {
    const domains = ['1secmail.com', '1secmail.org', '1secmail.net', 'tmpmail.net', 'mail.tm'];
    const randomString = Math.random().toString(36).substring(2, 12);
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    return `${randomString}@${randomDomain}`;
}

// Create new email endpoint
app.post('/api/create-email', async (req, res) => {
    try {
        const email = generateRandomEmail();
        
        res.json({
            success: true,
            email: email,
            message: 'Email created successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create email'
        });
    }
});

// Get messages endpoint
app.get('/api/messages/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const [login, domain] = email.split('@');

        // Try 1SecMail API first
        try {
            const response = await axios.get(`${API_SERVICES.ONESECMAIL.baseURL}/?action=getMessages&login=${login}&domain=${domain}`);
            
            if (response.data && response.data.length > 0) {
                const messages = await Promise.all(
                    response.data.map(async (msg) => {
                        try {
                            const messageResponse = await axios.get(
                                `${API_SERVICES.ONESECMAIL.baseURL}/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`
                            );
                            return {
                                id: msg.id,
                                from: messageResponse.data.from,
                                subject: messageResponse.data.subject,
                                body: messageResponse.data.textBody || messageResponse.data.htmlBody || 'No content',
                                time: new Date(messageResponse.data.date).toLocaleString(),
                                read: false
                            };
                        } catch (error) {
                            return {
                                id: msg.id,
                                from: msg.from,
                                subject: msg.subject,
                                body: 'Unable to load message content',
                                time: new Date(msg.date).toLocaleString(),
                                read: false
                            };
                        }
                    })
                );

                return res.json({
                    success: true,
                    messages: messages,
                    service: '1SecMail'
                });
            }
        } catch (error) {
            console.log('1SecMail failed, trying other services...');
        }

        // Try Juhe API as fallback
        try {
            const response = await axios.get(`${API_SERVICES.JUHE.baseURL}/messages?apikey=${API_SERVICES.JUHE.apiKey}&email=${email}`);
            
            if (response.data && response.data.messages) {
                return res.json({
                    success: true,
                    messages: response.data.messages.map(msg => ({
                        id: msg.id || Math.random(),
                        from: msg.from || 'Unknown',
                        subject: msg.subject || 'No Subject',
                        body: msg.body || 'No content',
                        time: msg.time || new Date().toLocaleString(),
                        read: false
                    })),
                    service: 'Juhe API'
                });
            }
        } catch (error) {
            console.log('Juhe API failed');
        }

        // Return empty if no messages
        res.json({
            success: true,
            messages: [],
            service: 'No service available'
        });

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch messages'
        });
    }
});

// Get single message endpoint
app.get('/api/message/:email/:messageId', async (req, res) => {
    try {
        const { email, messageId } = req.params;
        const [login, domain] = email.split('@');

        const response = await axios.get(
            `${API_SERVICES.ONESECMAIL.baseURL}/?action=readMessage&login=${login}&domain=${domain}&id=${messageId}`
        );

        res.json({
            success: true,
            message: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch message'
        });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📧 Temp Mail Service: http://localhost:${PORT}`);
});
