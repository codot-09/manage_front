document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "index.html";

  const historyList = document.getElementById("historyList");
  historyList.innerHTML = "";

  fetch("https://api.managelc.uz/api/test", {
    headers: { "accept": "*/*", "Authorization": `Bearer ${token}` }
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.data.length > 0) {
      data.data.forEach(test => {
        const card = document.createElement("div");
        card.className = "history-card";

        // Test card ichidagi content
        card.innerHTML = `
          <h3>Test #${test.id}</h3>
          <p><strong>Date:</strong> ${test.date}</p>
          <p><strong>Score:</strong> ${test.percentage}%</p>
        `;

        // Card click qilganda result page ga o‘tadi (id ni query param sifatida)
        card.addEventListener("click", () => {
          window.location.href = `result.html?id=${test.id}`;
        });

        // Hover animatsiyasi uchun class
        card.addEventListener("mouseenter", () => card.style.transform = "translateY(-5px) scale(1.02)");
        card.addEventListener("mouseleave", () => card.style.transform = "translateY(0) scale(1)");

        historyList.appendChild(card);
      });
    } else {
      historyList.innerHTML = "<p style='text-align:center; font-size:16px; color:rgba(255,255,255,0.7);'>No exam history found.</p>";
    }
  })
  .catch(err => {
    console.error(err);
    historyList.innerHTML = "<p style='text-align:center; font-size:16px; color:red;'>Failed to load exam history.</p>";
  });
});
