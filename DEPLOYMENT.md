# Deployment Guide for Virtual Assistant Application

This guide provides steps to deploy the Node.js Express application with MongoDB to a production environment and make it accessible via a domain.

## Prerequisites

- A server or cloud instance (e.g., VPS, AWS EC2, DigitalOcean Droplet)
- Domain name pointing to your server's IP address
- Node.js and npm installed on the server
- MongoDB instance accessible from the server (local or cloud MongoDB Atlas)
- Optional: Nginx installed for reverse proxy and SSL termination

## Steps

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd virtual-assistant
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set environment variables

Create a `.env` file in the root directory with the following variables:

```
PORT=3000
MONGODB_URI=<your-mongodb-connection-string>
OPENAI_API_KEY=<your-openai-api-key>
SMTP_HOST=<your-smtp-host>
SMTP_PORT=587
SMTP_USER=<your-email-address>
SMTP_PASS=<your-email-password>
```

Replace `<your-mongodb-connection-string>` with your MongoDB URI (e.g., from MongoDB Atlas or local MongoDB).

Replace `<your-openai-api-key>` with your OpenAI API key.

Replace SMTP settings with your email provider settings:
- For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587
- For Outlook: SMTP_HOST=smtp-mail.outlook.com, SMTP_PORT=587
- Use your email credentials for SMTP_USER and SMTP_PASS

### 4. Start the application

For production, it is recommended to use a process manager like PM2:

```bash
npm install -g pm2
pm2 start server.js --name virtual-assistant
pm2 save
pm2 startup
```

### 5. Configure Nginx as a reverse proxy (optional but recommended)

Install Nginx and create a configuration file for your domain:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/yourdomain /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Enable HTTPS with Let's Encrypt

Use Certbot to obtain and install SSL certificates:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts to complete SSL setup.

### 7. Verify deployment

- Visit `https://yourdomain.com` in your browser.
- The application should be accessible and functional.

## Additional Notes

- Ensure your MongoDB instance allows connections from your server IP.
- Monitor your application logs with PM2: `pm2 logs virtual-assistant`
- For scaling, consider containerization with Docker and orchestration with Kubernetes.
- Make sure to enable "Less secure app access" for Gmail or use App Passwords for better security.
- Test email functionality in development before deploying to production.

## New Features Implemented

### 1. Word Document Processing
- Endpoint: `GET /api/documents/word/:filename`
- Reads and displays Word document content
- Example: `GET /api/documents/word/KhaiDo_Company_Handbook.docx`

### 2. Professional Meeting Creation with Email Invitations
- Enhanced meeting creation with automatic email invitations
- Participants receive professional email invitations with meeting details
- Email templates include meeting title, description, time, and location

### 3. Chat-based Meeting Scheduling
- AI-powered meeting scheduling through chat messages
- GPT integration to detect meeting scheduling intents
- Automatic meeting creation and email notifications

### 4. MongoDB Query Examples
- See `scripts/mongodb-queries.js` for database interaction examples
- Includes queries for documents, meetings, chats, tasks, and users

---

If you need assistance with any specific hosting provider or deployment step, please let me know.
