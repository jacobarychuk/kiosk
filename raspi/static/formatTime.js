function formatTime(unixSeconds) {
  const date = new Date(unixSeconds * 1000); // Multiply by 1000 to convert to milliseconds

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${month} ${day}, ${year} ${hours}:${minutes}`;
}