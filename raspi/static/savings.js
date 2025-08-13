const fetchSavings = () => {
  fetch('/savings')
    .then(response => {
      return response.json();
    })
    .then(data => {

      // Check if a sample has been received yet
      if (data.error) {
        return;
      }

      document.getElementById("savings-timestamp").textContent = formatDate(data.earliest_timestamp);
      document.getElementById("savings-value").textContent = data.total_savings.toFixed(2);

    })
    .catch(error => {
      console.error("Error fetching savings:", error);
    });
};

setInterval(fetchSavings, 10000);