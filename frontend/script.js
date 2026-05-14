const upldFile = document.getElementById("upldFile");
const imagepreview = document.getElementById("imagepreview");
const resultText = document.getElementById("resultText");
const analyzebt = document.getElementById("analyzebt");

const barFill = document.getElementById("barFill");
const barLabel = document.getElementById("barLabel");

let selectedFile = null;

const API_URL = "https://fakehunter-00ui.onrender.com";

// formatear el UI seguramente
function resetUI() {
  barFill.style.transition = "none";
  barFill.style.width = "0%";

  barLabel.textContent = "";
  barLabel.classList.remove("show");
}

const clearBtn = document.getElementById("clearBtn");

function clearAll() {
  selectedFile = null;

  upldFile.value = "";

  imagepreview.classList.remove("showPreview");
  imagepreview.innerHTML = "";

  resultText.textContent = "Sube un archivo para analizar.";

  barFill.style.width = "0%";
  barLabel.textContent = "";
  barLabel.classList.remove("show");
}

clearBtn.addEventListener("click", clearAll);

// vista de archivo
upldFile.addEventListener("change", () => {
  selectedFile = upldFile.files[0];

  if (!selectedFile) return;

  resetUI();

  resultText.textContent = "Archivo listo. Pulsa analizar.";

  imagepreview.innerHTML = "";

const fileURL = URL.createObjectURL(selectedFile);

const type = selectedFile.type || "";

// ALWAYS open container FIRST
imagepreview.classList.remove("showPreview");

setTimeout(() => {
  imagepreview.classList.add("showPreview");
}, 10);

if (type.startsWith("image/")) {
  const img = document.createElement("img");

  img.style.opacity = "0";
  img.style.transition = "opacity 0.4s ease";

  img.onload = () => {
    img.style.opacity = "1";
  };

  img.src = fileURL;
  imagepreview.appendChild(img);
}

else if (type.startsWith("video/")) {
  const video = document.createElement("video");

  video.style.opacity = "0";
  video.style.transition = "opacity 0.4s ease";

  video.onloadeddata = () => {
    video.style.opacity = "1";
  };

  video.src = fileURL;
  video.controls = true;

  imagepreview.appendChild(video);
}

  else {
    resultText.textContent = "Archivo no soportado.";
    selectedFile = null;
  }
});

// analizar boton :D
analyzebt.addEventListener("click", async () => {
  
  if (!selectedFile) {
    alert("Primero sube un archivo.");
    return;
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime"
  ];

  if (!allowedTypes.includes(selectedFile.type)) {
    alert("Tipo de archivo incorrecto!");
    return;
  }

  if (!selectedFile) {
    resultText.textContent = "Sube un archivo primero.";
    return;
  }

  resetUI();

  resultText.textContent = "Escaneando frames...";

  const formData = new FormData();
  formData.append("file", selectedFile);

  try {
    const res = await fetch(`${API_URL}/analyze`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    console.log("AI RESPONSE:", data.result);

    resultText.textContent = data.result;

    // safe % extract
    let percent = 0;

    const text = data.result;

    const match =
      text.match(/(\d{1,3})\s*%/) ||
      text.match(/:\s*(\d{1,3})/) ||
      text.match(/(\d{1,3})/);

    if (match) {
      percent = Math.max(0, Math.min(parseInt(match[1]), 100));
    }

    // force reset before animation
    barFill.style.transition = "none";
    barFill.style.width = "0%";

    setTimeout(() => {
      barFill.style.transition = "width 1s ease";
      barFill.style.width = percent + "%";
    }, 150);

    // label fade in
    setTimeout(() => {
      barLabel.textContent = `${percent}% AI`;
      barLabel.classList.add("show");
    }, 700);

  } catch (err) {
    console.error(err);
    resultText.textContent =
      "Servidor en reposo o error. Intenta otra vez.";
  }
});