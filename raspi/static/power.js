// Chart of historical power data
var chartPowerHistory = new Highcharts.stockChart({
  chart: {
    renderTo: 'chart-power-history',
    zooming: {
      mouseWheel: { enabled: false },
    },
  },
  time: { useUTC: false },
  title: {
    text: 'Historical Power Generation & Consumption',
    style: { fontSize: '1.2em' },
  },
  legend: { enabled: true },
  navigator: { enabled: false },
  scrollbar: { enabled: false },
  rangeSelector: {
    buttons: [
      { type: 'all', text: 'All' },
      { type: 'day', count: 1, text: '1d' },
      { type: 'hour', count: 1, text: '1h' },
      { type: 'minute', count: 1, text: '1m' },
    ],
    selected: 0, // Start with "All" selected by default
    inputEnabled: true, // Allows manual date typing
  },
  series: [
    {
      type: "line",
      showInLegend: true,
      name: "Solar PV Array",
      color: "#17becf",
      dashStyle: "Dash",
      data: []
    },
    {
      type: "line",
      showInLegend: true,
      name: "Preheat Tank",
      color: "#ff7f0e",
      dashStyle: "Dash",
      data: []
    },
    {
      type: "line",
      showInLegend: true,
      name: "Hybrid Hot Water Tank",
      color: "#d62728",
      dashStyle: "Solid",
      data: []
    },
  ],
  plotOptions: {
    line: {
      dataLabels: { enabled: false },
      marker: { enabled: false },
    },
  },
  xAxis: {
    title: { text: 'Time' },
    type: 'datetime',
  },
  yAxis: {
    title: { text: 'Power (kWh)' },
    opposite: false,
  },
  credits: { enabled: false },
});

const fetchAllPowerData = () => {
  const now = Math.floor(Date.now() / 1000); // Unix seconds
  const start = now - (60 * 60 * 24); // Last 24 hours
  const end = now;

  fetch(`/power-range?start=${start}&end=${end}`)
    .then(response => {
      return response.json();
    })
    .then(data => {

      // Check if any of the series have data
      const hasData = data.solar_pv_array_power && data.solar_pv_array_power.length > 0;
      if (!hasData) {
        return;
      }

      chartPowerHistory.series[0].setData(data.solar_pv_array_power);
      chartPowerHistory.series[1].setData(data.preheat_tank_power);
      chartPowerHistory.series[2].setData(data.hybrid_hot_water_tank_power);
    })
    .catch(error => {
      console.error("Error fetching historical data:", error);
    });
};

fetchAllPowerData();

const fetchLivePowerData = () => {
  fetch('/latest')
    .then(response => {
      return response.json();
    })
    .then(data => {

      // Check if a sample has been received yet
      if (data.error) {
        return;
      }

      // Live section of power tab
      document.getElementById("live-solar-pv-array-power").textContent = data.solar_pv_array_power.toFixed(2);
      document.getElementById("live-preheat-tank-power").textContent = data.hybrid_hot_water_tank_power.toFixed(2);
      document.getElementById("live-hybrid-hot-water-tank-power").textContent = data.hybrid_hot_water_tank_power.toFixed(2);

      // Process tab
      document.getElementById("solar-pv-array-power-value").textContent = data.solar_pv_array_power.toFixed(2);
      document.getElementById("preheat-tank-power-value").textContent = data.hybrid_hot_water_tank_power.toFixed(2);
      document.getElementById("hybrid-hot-water-tank-power-value").textContent = data.hybrid_hot_water_tank_power.toFixed(2);
    })
    .catch(error => {
      console.error("Error fetching latest sample:", error);
    });
};

setInterval(fetchLivePowerData, 10000);
