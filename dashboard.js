document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) window.location.href = "/login";

  const profileCard = document.getElementById("profileCard");
  const profileName = document.getElementById("profileName");
  const profileDetails = document.getElementById("profileDetails");
  const profileImg = document.getElementById("profileImg");
  const userLevel = document.getElementById("userLevel");
  const userPercentage = document.getElementById("userPercentage");
  const leaderboardList = document.getElementById("leaderboardList");
  const logoutBtn = document.getElementById("logoutBtn");

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  });

  // ✅ Profile yuklash funksiyasi
  function loadProfile() {
    fetch("https://api.managelc.uz/user", {
      headers: { "accept": "*/*", "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          profileName.textContent = res.data.fullName;
          profileDetails.textContent = `${res.data.region}, ${res.data.city} | ${res.data.phone}`;
          profileImg.src = res.data.imageUrl || "User-Avatar-Profile-Clip-Art-Transparent-PNG.png";
        }
      });
  }

  // Page ochilganda chaqirish
  loadProfile();

  // Hover qilganda ham qayta chaqirish
  profileCard.addEventListener("mouseenter", loadProfile);

  // Dashboard stats
  fetch("https://api.managelc.uz/user/dashboard", {
    headers: { "accept": "*/*", "Authorization": `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        userLevel.textContent = res.data.status;
        userPercentage.textContent = res.data.percentage;
      }
    });

  // Leaderboard
  fetch("https://api.managelc.uz/user/leaderBoard", {
    headers: { "accept": "*/*", "Authorization": `Bearer ${token}` }
  })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        const top5 = res.data.slice(0, 5);
        top5.forEach((user, i) => {
          const card = document.createElement("div");
          card.className = "leaderboard-card";
          if (i === 0) card.classList.add("gold");
          else if (i === 1) card.classList.add("silver");
          else if (i === 2) card.classList.add("bronze");

          card.innerHTML = `<span class="rank">${user.rank}</span> <span>${user.fullName}</span> <span>${user.score} pts</span>`;
          leaderboardList.appendChild(card);
        });
      }
    });
});
