// Constantes (variables) e imports

require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const OpenAI = require("openai");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(cors());
app.use(express.json());


// Multer upload con límite de 20MB
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});


// health
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});


// root
app.get("/", (req, res) => {
  res.send("FakeHunter backend running 🔥 Ya está siendo ejecutado!");
});


// convertir archivo a base64
function fileToBase64(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

// extraer 3 cuadros del video (optimizados)
function extractFrames(videoPath, folderPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(folderPath, { recursive: true });

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["10%", "50%", "90%"],
        folder: folderPath,
        filename: "frame-%i.jpg",
        size: "640x360"
      })
      .on("end", resolve)
      .on("error", reject);
  });
}

// timeout helper
const timeout = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );

// ANALYZE
app.post("/analyze", upload.single("file"), async (req, res) => {
  let filePath;
  let frameDir;

  try {
    if (!req.file) {
      return res.status(400).json({
        result: "No file uploaded"
      });
    }

    filePath = req.file.path;
    const mimeType = req.file.mimetype;

    let images = [];

    // IMAGEN
    if (mimeType.startsWith("image/")) {
      const base64 = fileToBase64(filePath);

      images.push({
        type: "input_image",
        image_url: `data:${mimeType};base64,${base64}`
      });
    }

    // VIDEO
    else if (mimeType.startsWith("video/")) {
      const stats = fs.statSync(filePath);

      // limitar tamaño de video
      if (stats.size > 20 * 1024 * 1024) {
        fs.unlinkSync(filePath);

        return res.status(400).json({
          result: "Video demasiado pesado. Máximo 20MB."
        });
      }

      frameDir = path.join(
        "uploads",
        path.basename(filePath) + "_frames"
      );

      fs.mkdirSync(frameDir, { recursive: true });

      await extractFrames(filePath, frameDir);

      const frameFiles = fs.readdirSync(frameDir);

      for (const frame of frameFiles) {
        const fullPath = path.join(frameDir, frame);

        const base64 = fileToBase64(fullPath);

        images.push({
          type: "input_image",
          image_url: `data:image/jpeg;base64,${base64}`
        });

        // borrar frame inmediatamente para ahorrar memoria/disco
        fs.unlinkSync(fullPath);
      }
    }

    // tipo inválido
    else {
      fs.unlinkSync(filePath);

      return res.status(400).json({
        result: "Tipo de archivo no permitido"
      });
    }

    // llamada OpenAI
    const response = await Promise.race([
      client.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: `
Eres un analizador forense de imágenes y videos.

Tu tarea NO es decidir si algo “parece real”.

Tu tarea es detectar señales ocultas de generación artificial o manipulación.

Reglas:

- Analiza microtexturas, patrones repetitivos y artefactos de difusión.
- Busca geometría sutilmente imperfecta.
- Evalúa reflejos, sombras y consistencia física.
- Examina bordes, transiciones y detalles finos.
- Detecta estructuras demasiado perfectas o artificialmente coherentes.

IMPORTANTE:
Las imágenes hiperrealistas generadas por IA pueden parecer completamente reales.
NO uses realismo como evidencia de autenticidad.

Debes asumir que una imagen puede ser IA aunque sea visualmente perfecta.

NO clasifiques videojuegos, CGI, dibujos o arte digital estilizado como IA por defecto.

En videos:
evalúa consistencia temporal entre frames.

Responde SOLO:

Probabilidad IA: X%
Explicación: breve explicación profesional.

Si la imagen contiene texto o capturas de redes sociales,
evalúa si el contenido parece potencialmente engañoso,
inconsistente o sospechoso contextualmente.
NO afirmes que algo es falso sin evidencia clara.
                `
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Analiza este archivo."
              },
              ...images
            ]
          }
        ]
      }),
      timeout(25000)
    ]);

    // borrar archivo subido
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // borrar carpeta de frames
    if (frameDir && fs.existsSync(frameDir)) {
      fs.rmSync(frameDir, {
        recursive: true,
        force: true
      });
    }

    res.json({
      result: response.output_text || "Sin resultado."
    });

  } catch (err) {
    console.error("ANALYZE ERROR:", err);

    // limpiar archivo
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // limpiar carpeta de frames
    if (frameDir && fs.existsSync(frameDir)) {
      fs.rmSync(frameDir, {
        recursive: true,
        force: true
      });
    }

    // timeout
    if (err.message === "timeout") {
      return res.status(504).json({
        result: "El análisis tardó demasiado. Intenta otra vez."
      });
    }

    // archivo demasiado grande
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        result: "Archivo demasiado pesado. Máximo 20MB."
      });
    }

    res.status(500).json({
      result: "Error procesando la IA."
    });
  }
});


// iniciar server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});