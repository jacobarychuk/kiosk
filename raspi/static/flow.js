// Chart of historical hot water flow rate data
var chartFlowHistory = new Highcharts.stockChart({
  chart: {
    renderTo: 'chart-flow-history',
    zooming: {
      mouseWheel: { enabled: false },
    },
  },
  time: { useUTC: false },
  title: {
    text: 'Historical Hot Water Flow Rate',
    style: {
      fontSize: '1.2rem',
      fontFamily: 'Verdana',
    },
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
    labelStyle: { fontFamily: 'Verdana' },
    inputStyle: { fontFamily: 'Verdana' },
    buttonTheme: {
      style: { fontFamily: 'Verdana' },
    },
  },
  series: [
    {
      type: "line",
      showInLegend: false,
      name: "Hot Water",
      color: "#d62728",
      dashStyle: "Solid",
      data: []
    },
  ],
  tooltip: {
    style: { fontFamily: 'Verdana' },
  },
  plotOptions: {
    line: {
      dataLabels: { enabled: false },
      marker: { enabled: false },
    },
  },
  xAxis: {
    title: {
      text: 'Time',
      style: { fontFamily: 'Verdana' },
    },
    type: 'datetime',
    labels: {
      style: { fontFamily: 'Verdana' },
    },
  },
  yAxis: {
    title: {
      text: 'Flow (L/min)',
      style: { fontFamily: 'Verdana' },
    },
    opposite: false,
    labels: {
      style: { fontFamily: 'Verdana' },
    },
  },
  credits: { enabled: false },
});

const fetchAllFlowData = () => {
  const now = Math.floor(Date.now() / 1000); // Unix seconds
  const start = 0;
  const end = now;

  fetch(`/flow-range?start=${start}&end=${end}`)
    .then(response => {
      return response.json();
    })
    .then(data => {

      // Check if the series has data
      const hasData = data.flow && data.flow.length > 0;
      if (!hasData) {
        return;
      }

      chartFlowHistory.series[0].setData(data.flow);
    })
    .catch(error => {
      console.error("Error fetching historical data:", error);
    });
};

fetchAllFlowData();

const chartFlowHistoryButtons = chartFlowHistory.rangeSelector.buttons;
chartFlowHistoryButtons.forEach((button, i) => {
  button.element.addEventListener('click', () => {
    if (i === 0) { // "All" is selected
      fetchAllFlowData();
    }
  });
});

const fetchLiveFlowData = () => {
  fetch('/latest')
    .then(response => {
      return response.json();
    })
    .then(data => {

      // Check if a sample has been received yet
      if (data.error) {
        return;
      }

      // Live section of flow tab
      document.getElementById("live-flow").textContent = data.flow.toFixed(2);

      // Process tab
      document.getElementById("hot-flow-value").textContent = data.flow.toFixed(2);
      document.getElementById("process-diagram-timestamp").textContent = formatTime(data.timestamp);
    })
    .catch(error => {
      console.error("Error fetching latest sample:", error);
    });
};

setInterval(fetchLiveFlowData, 10000);
