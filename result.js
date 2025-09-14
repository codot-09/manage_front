document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  // URL dan testId olish (?id=12)
  const urlParams = new URLSearchParams(window.location.search);
  const testId = urlParams.get("id");
  if (!testId) {
    alert("Test ID not found!");
    window.location.href = "history.html";
    return;
  }

  const resultContainer = document.getElementById("resultContainer");
  const backBtn = document.getElementById("backBtn");
  const pdfBtn = document.getElementById("pdfBtn");

  // Back button
  backBtn.addEventListener("click", () => {
    window.location.href = "history.html";
  });

  // PDF yuklab olish
  pdfBtn.addEventListener("click", () => {
    fetch(`https://api.managelc.uz/api/test/${testId}/pdf`, {
      headers: {
        "accept": "*/*",
        "Authorization": `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to download PDF");
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `test-result-${testId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => {
        console.error(err);
        alert("Failed to download PDF. Try again later.");
      });
  });

  // Test resultni olish
  fetch(`https://api.managelc.uz/api/test/${testId}`, {
    headers: {
      "accept": "*/*",
      "Authorization": `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        resultContainer.innerHTML = "<p>Failed to load result.</p>";
        return;
      }

      const result = data.data;

      resultContainer.innerHTML = `
        <div class="result-card">
          <h2>📊 Test Result #${testId}</h2>
          <p><strong>Total Questions:</strong> ${result.totalQuestions}</p>
          <p><strong>Correct Answers:</strong> ${result.correctAnswers}</p>
          <p><strong>Score:</strong> ${result.percentage}%</p>
          <p><strong>Status:</strong> ${result.status}</p>
          <p><strong>Date:</strong> ${result.localDate}</p>
          <div class="description">
            <h3>📝 Analysis</h3>
            <div class="markdown">${marked.parse(result.description)}</div>
          </div>
        </div>
      `;
    })
    .catch(err => {
      console.error(err);
      resultContainer.innerHTML = "<p>Error loading result.</p>";
    });
});
