import React, { useState, useRef } from "react";
import {
  Bar,
  Pie,
  Doughnut,
  Radar,
  PolarArea,
  Bubble,
  Line,
} from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import Papa from "papaparse";
import HeatMap from "react-heatmap-grid";
import { ResponsiveTreeMap } from "@nivo/treemap";
import { ResponsiveSunburst } from "@nivo/sunburst";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  Legend
);

function EnhancedChartApp() {
  const [query, setQuery] = useState("Show sales by region");
  const [data, setData] = useState([]);
  const [queryHistory, setQueryHistory] = useState([]);
  const [chartType, setChartType] = useState("bar");
  const [isManualChartSelected, setIsManualChartSelected] = useState(false);
  const [sortOrder, setSortOrder] = useState("");
  const [renderedChart, setRenderedChart] = useState(null);
  const recognitionRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => setData(result.data),
    });
  };

  const toggleListening = () => {
    if (!("webkitSpeechRecognition" in window)) return alert("Not supported.");
    if (!recognitionRef.current) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.lang = "en-US";
      recognition.onresult = (e) => setQuery(e.results[0][0].transcript);
      recognitionRef.current = recognition;
    }
    recognitionRef.current.start();
  };

  const parseInstruction = (nl, columns) => {
    const lower = nl.toLowerCase();
    const instruction = {
      groupBy: null,
      aggregation: "sum",
      column: null,
      chart: "bar",
    };

    if (lower.includes("heatmap")) instruction.chart = "heatmap";
    else if (lower.includes("grouped")) instruction.chart = "groupedBar";
    else if (lower.includes("stacked") && lower.includes("bar"))
      instruction.chart = "stackedBar";
    else if (lower.includes("stacked") && lower.includes("line"))
      instruction.chart = "stackedLine";
    else if (lower.includes("tree")) instruction.chart = "treemap";
    else if (lower.includes("sunburst")) instruction.chart = "sunburst";
    else if (lower.includes("pie")) instruction.chart = "pie";
    else if (lower.includes("line")) instruction.chart = "line";
    else if (lower.includes("bar")) instruction.chart = "bar";
    else if (lower.includes("doughnut")) instruction.chart = "doughnut";
    else if (lower.includes("radar")) instruction.chart = "radar";
    else if (lower.includes("polar")) instruction.chart = "polarArea";
    else if (lower.includes("bubble")) instruction.chart = "bubble";

    if (lower.includes("average") || lower.includes("avg"))
      instruction.aggregation = "average";
    else if (lower.includes("count")) instruction.aggregation = "count";

    columns.forEach((col) => {
      if (lower.includes(col.toLowerCase())) {
        if (lower.includes("by " + col.toLowerCase()))
          instruction.groupBy = col;
        else if (!instruction.column) instruction.column = col;
      }
    });

    if (!instruction.groupBy) {
      instruction.groupBy = columns.find((col) => col.match(/[a-zA-Z]/));
    }

    if (!instruction.column && instruction.aggregation !== "count") {
      instruction.column =
        columns.find((col) => col.match(/sales|amount|price|value|total/i)) ||
        columns[1];
    }

    return instruction;
  };

  const applyTransformation = (data, instruction, sortOrder) => {
    const grouped = {};
    data.forEach((row) => {
      const key = row[instruction.groupBy];
      const value = parseFloat(row[instruction.column]) || 0;
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      grouped[key].total += value;
      grouped[key].count += 1;
    });

    let finalData = {};
    Object.entries(grouped).forEach(([key, { total, count }]) => {
      if (instruction.aggregation === "average") finalData[key] = total / count;
      else if (instruction.aggregation === "count") finalData[key] = count;
      else finalData[key] = total;
    });

    if (sortOrder === "asc") {
      finalData = Object.fromEntries(
        Object.entries(finalData).sort(([, a], [, b]) => a - b)
      );
    } else if (sortOrder === "desc") {
      finalData = Object.fromEntries(
        Object.entries(finalData).sort(([, a], [, b]) => b - a)
      );
    }

    return finalData;
  };

  const handleTransform = () => {
    if (!data.length) return;
    const parsed = parseInstruction(query, Object.keys(data[0]));
    if (isManualChartSelected) parsed.chart = chartType;
    setQueryHistory((prev) => [query, ...prev.slice(0, 9)]);

    if (parsed.chart === "sunburst") {
      const hierarchyData = {};

      data.forEach((row) => {
        const parent = row[parsed.groupBy] || "Unknown";
        const value = parseFloat(row[parsed.column]) || 0;

        if (!hierarchyData[parent]) hierarchyData[parent] = 0;
        hierarchyData[parent] += value;
      });

      const children = Object.entries(hierarchyData).map(([parent, value]) => ({
        name: parent,
        id: parent,
        value: Math.max(value, 0.1),
      }));

      const sunburstData = {
        name: "Root",
        children,
      };

      setRenderedChart(
        <div style={{ height: 400 }}>
          <ResponsiveSunburst
            data={sunburstData}
            id="name"
            value="value"
            animate={true}
            cornerRadius={2}
            borderWidth={1}
            colors={{ scheme: "nivo" }}
            childColor={{ from: "color", modifiers: [["brighter", 0.1]] }}
            borderColor={{ from: "color", modifiers: [["darker", 0.3]] }}
            motionConfig="gentle"
            enableArcLabels={true}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor={{ from: "color", modifiers: [["darker", 3]] }}
          />
        </div>
      );
      return;
    }

    const grouped = applyTransformation(data, parsed, sortOrder);
    const labels = Object.keys(grouped);
    const values = Object.values(grouped);

    if (parsed.chart === "heatmap") {
      setRenderedChart(
        <HeatMap
          xLabels={labels}
          yLabels={["Metric"]}
          data={[values]}
          height={30}
        />
      );
    } else if (parsed.chart === "treemap") {
      setRenderedChart(
        <div style={{ height: 400 }}>
          <ResponsiveTreeMap
            data={{
              name: "root",
              children: labels.map((label, i) => ({
                name: label,
                id: label,
                value: values[i],
              })),
            }}
            identity="name"
            value="value"
            colors={{ scheme: "nivo" }}
          />
        </div>
      );
    } else {
      const dataset = {
        label: `${parsed.aggregation} of ${parsed.column || parsed.groupBy}`,
        data: values,
        backgroundColor: [
          "#36A2EB",
          "#FF6384",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
          "#FF9F40",
        ],
      };

      const chartMap = {
        bar: <Bar data={{ labels, datasets: [dataset] }} />,
        line: <Line data={{ labels, datasets: [dataset] }} />,
        pie: <Pie data={{ labels, datasets: [dataset] }} />,
        doughnut: <Doughnut data={{ labels, datasets: [dataset] }} />,
        radar: <Radar data={{ labels, datasets: [dataset] }} />,
        polarArea: <PolarArea data={{ labels, datasets: [dataset] }} />,
        bubble: <Bubble data={{ labels, datasets: [dataset] }} />,
      };
      setRenderedChart(chartMap[parsed.chart] || chartMap["bar"]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Enhanced Chart Generator</h1>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="mb-4"
      />

      <div className="flex gap-2 mb-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="border p-2 w-full"
        />
        <button
          onClick={toggleListening}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          🎤
        </button>
      </div>

      <div className="flex gap-4 mb-4">
        <select
          value={chartType}
          onChange={(e) => {
            setChartType(e.target.value);
            setIsManualChartSelected(true);
          }}
          className="border p-2"
        >
          <option value="bar">Bar</option>
          <option value="groupedBar">Grouped Bar</option>
          <option value="stackedBar">Stacked Bar</option>
          <option value="line">Line</option>
          <option value="stackedLine">Stacked Line</option>
          <option value="pie">Pie</option>
          <option value="doughnut">Doughnut</option>
          <option value="radar">Radar</option>
          <option value="polarArea">Polar Area</option>
          <option value="bubble">Bubble</option>
          <option value="heatmap">Heatmap</option>
          <option value="treemap">Tree Map</option>
          <option value="sunburst">Sunburst</option>
        </select>

        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="border p-2"
        >
          <option value="">No Sort</option>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>

        <button
          onClick={handleTransform}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Generate
        </button>
      </div>

      <div className="bg-white p-4 shadow rounded">{renderedChart}</div>

      <h2 className="text-xl font-bold mt-6">🕒 Query History</h2>
      <ul className="list-disc ml-6">
        {queryHistory.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </div>
  );
}

export default EnhancedChartApp;
