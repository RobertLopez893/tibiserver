require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('./firebase');
const sgMail = require('@sendgrid/mail');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Función para enviar correo de verificación
async function sendVerificationEmail(email) {
  const actionCodeSettings = {
    url: 'https://tibibalance.page.link/confirmacion',
    handleCodeInApp: true,
    android: {
      packageName: 'com.tibibalance.android',
      installApp: true,
      minimumVersion: '1',
    },
  };

  // Genera el enlace de verificación de correo usando Firebase
  const link = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);

  // Contenido del correo
  const msg = {
    to: email,
    from: {
      email: process.env.FROM_EMAIL,
      name: "TibiBalance Team"
    },
    subject: 'Correo de verificación a TibiBalance',
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirmación de correo - TIBIBALANCE</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #f2f6f9;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }

          .container {
            max-width: 480px;
            margin: 50px auto;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
            padding: 32px 24px;
            text-align: center;
          }

          .logo {
            font-size: 28px;
            font-weight: 700;
            color: #00897B;
            margin-bottom: 16px;
          }

          .image-container {
            margin: 24px auto;
          }

          .image-container img {
            width: 120px;
            height: auto;
          }

          .title {
            font-size: 22px;
            color: #333333;
            font-weight: bold;
            margin-bottom: 16px;
          }

          .text {
            font-size: 16px;
            color: #555555;
            margin-bottom: 28px;
            line-height: 1.5;
          }

          .button {
            background-color: #007BFF;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 28px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 24px;
            transition: background-color 0.3s ease;
            display: inline-block;
          }

          .button:hover {
            background-color: #005ecb;
          }

          .footer {
            font-size: 14px;
            color: #888888;
            margin-top: 32px;
            line-height: 1.4;
          }

          @media (max-width: 500px) {
            .container {
              margin: 20px;
              padding: 24px 16px;
            }

            .title {
              font-size: 20px;
            }

            .text, .footer {
              font-size: 15px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">TIBIBALANCE</div>

          <div class="image-container">
            <img src="https://i.imgur.com/mCen4Hs.png" alt="Frijolito confirmando">
          </div>

          <div class="title">Confirma tu correo electrónico</div>

          <div class="text">
            Hola:<br><br>
            Gracias por registrarte en <strong>Tibibalance</strong>.<br>
            Por favor confirma tu correo electrónico para empezar a usar la app.
          </div>

          <a href="${link}" class="button">Confirmar correo electrónico</a>

          <div class="footer">
            Si no fuiste tú, puedes ignorar este correo electrónico<br>
            de manera segura.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  // Enviar el correo
  await sgMail.send(msg);
  console.log(`Correo de verificación enviado a ${email}`);
}

// Almacén temporal en memoria para rastrear los intentos
const emailAttempts = {};

// Endpoint API
app.post('/send-confirmation', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const currentTime = Date.now();
  const attemptWindow = 1 * 60 * 1000; // 30 minutos (Aumentado)
  const maxAttempts = 5; // Máximo de 5 intentos (Aumentado)

  // Verificar si el correo ya tiene intentos registrados
  if (!emailAttempts[email]) {
    emailAttempts[email] = { count: 0, lastAttempt: currentTime };
  }

  const userAttempts = emailAttempts[email];

  // Limpiar los intentos si ya pasó el tiempo
  if (currentTime - userAttempts.lastAttempt > attemptWindow) {
    userAttempts.count = 0;
    userAttempts.lastAttempt = currentTime;
  }

  // Verificar si excede el límite de intentos
  if (userAttempts.count >= maxAttempts) {
    return res.status(429).json({ error: 'Demasiados intentos. Por favor, intenta más tarde.' });
  }

  // Incrementar el contador de intentos
  userAttempts.count++;
  userAttempts.lastAttempt = currentTime;

  try {
    await sendVerificationEmail(email);
    res.status(200).json({ message: 'Correo enviado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error enviando correo' });
  }
});

app.get('/', (req, res) => {
  res.send('Servidor en Render funcionando');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
