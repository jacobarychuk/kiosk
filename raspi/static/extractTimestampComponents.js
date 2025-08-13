function extractTimestampComponents(unixSeconds) {
  const date = new Date(unixSeconds * 1000); // Multiply by 1000 to convert to milliseconds

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    month: months[date.getMonth()],
    day: String(date.getDate()).padStart(2, "0"),
    year: date.getFullYear(),
    hours: String(date.getHours()).padStart(2, "0"),
    minutes: String(date.getMinutes()).padStart(2, "0")
  };
}

// MMM DD, YYYY HH:MM
function formatDateTime(unixSeconds) {
  const { month, day, year, hours, minutes } = extractTimestampComponents(unixSeconds);
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

// MMM DD, YYYY
function formatDate(unixSeconds) {
  const { month, day, year } = extractTimestampComponents(unixSeconds);
  return `${month} ${day}, ${year}`;
}