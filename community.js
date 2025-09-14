function copyCard() {
  const cardNum = document.getElementById("cardNum").innerText;
  navigator.clipboard.writeText(cardNum).then(() => {
    const btn = document.querySelector(".donation button");
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    btn.style.background = "#28a745"; // muvaffaqiyatli yashil rang
    setTimeout(() => {
      btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy';
      btn.style.background = "var(--main-color)";
    }, 2000);
  });
}
