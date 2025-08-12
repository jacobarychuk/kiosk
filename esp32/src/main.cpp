#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "secrets.h"

const String URL = "https://spca.sccsa-projects.org";

#define NUM_SENSORS 5
DeviceAddress sensorAddresses[NUM_SENSORS] = {
  { 0x28, 0xD1, 0xE2, 0x52, 0x00, 0x00, 0x00, 0x6B }, // Glycol
  { 0x28, 0x31, 0x0A, 0x52, 0x00, 0x00, 0x00, 0xA6 }, // Preheat
  { 0x28, 0xF9, 0xAF, 0x51, 0x00, 0x00, 0x00, 0xF1 }, // Ambient
  { 0x28, 0x25, 0x8C, 0x50, 0x00, 0x00, 0x00, 0x71 }, // Source
  { 0x28, 0xC7, 0xC0, 0x50, 0x00, 0x00, 0x00, 0xFE }  // Hot
};
const String sensorNames[NUM_SENSORS] = {
  "glycol",
  "preheat",
  "ambient",
  "source",
  "hot"
};

// CT sensor data wire is connected to GPIO 34
#define CT_SENSOR 34
#define ADC_OFFSET 115
#define MAX_ADC_VALUE 4095 // Maximum value for 12-bit resolution
#define REFERENCE_VOLTAGE 3.3
#define MAINS_VOLTAGE 120
#define TRANSFORMATION_RATIO 15
#define DC_OFFSET 2048
#define VOLTAGE_OFFSET 40

// Water flow sensor data wire is connected to GPIO 13
#define WATER_FLOW_SENSOR_DATA 13

volatile unsigned int pulseCount = 0;
const float K_VALUE = 5.5;

// Temperature sensor data wire is connected to GPIO 15
#define ONE_WIRE_BUS 15

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void pulseCounter() {
  pulseCount++;
}

int getFlowRate() {
  pulseCount = 0;

  // Count pulses for one second
  attachInterrupt(WATER_FLOW_SENSOR_DATA, pulseCounter, FALLING);
  delay(1000);
  detachInterrupt(WATER_FLOW_SENSOR_DATA);

  return pulseCount / K_VALUE; // Flow rate in L/min
}

void setup() {
  Serial.begin(115200);
  sensors.begin();

  WiFi.begin(SSID, PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.print("\nConnected! IP Address: ");
  Serial.println(WiFi.localIP());

  configTime(-28800, 3600, "time.google.com");
  Serial.print("Synchronizing time...");
  time_t now = time(nullptr);
  while (now < 100000) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.print("\nSynchronized! Time: ");
  Serial.println(time(nullptr));
}

void loop() {
  // Sample the AC signal for approximately one second
  int peakValue = 0;
  int troughValue = 4095;
  for (int i = 0; i < 1000; i++) {
    int value = analogRead(CT_SENSOR);

    int adjustedValue = value + ADC_OFFSET;
    Serial.print("ADC Value: ");
    Serial.println(adjustedValue);

    double voltage = adjustedValue * REFERENCE_VOLTAGE / MAX_ADC_VALUE;
    Serial.print("Voltage: ");
    Serial.println(voltage);

    if (value > peakValue) peakValue = value;
    if (value < troughValue) troughValue = value;
    delay(1);
  }

  int adjustedPeakValue = peakValue + ADC_OFFSET - VOLTAGE_OFFSET; // Account for error in ADC and noise in CT sensor
  Serial.print("Peak Value: ");
  Serial.println(adjustedPeakValue);

  double peakVoltage = adjustedPeakValue * REFERENCE_VOLTAGE / MAX_ADC_VALUE;
  Serial.print("Peak Voltage: ");
  Serial.println(peakVoltage);

  int adjustedTroughValue = troughValue + ADC_OFFSET + VOLTAGE_OFFSET; // Account for error in ADC and noise in CT sensor
  Serial.print("Trough Value: ");
  Serial.println(adjustedTroughValue);

  double troughVoltage = adjustedTroughValue * REFERENCE_VOLTAGE / MAX_ADC_VALUE;
  Serial.print("Trough Voltage: ");
  Serial.println(troughVoltage);

  double peakVoltageAC = (adjustedPeakValue - DC_OFFSET) * REFERENCE_VOLTAGE / MAX_ADC_VALUE;
  Serial.print("Peak Voltage (AC): ");
  Serial.println(peakVoltageAC);
  double current = peakVoltageAC * TRANSFORMATION_RATIO;
  Serial.print("Current: ");
  Serial.println(current);
  double solarPvArrayPower = current * MAINS_VOLTAGE / 1000;
  Serial.print("Power (kW): ");
  Serial.println(solarPvArrayPower);

  sensors.requestTemperatures();

  delay(750);

  String json = "{\"timestamp\": " + String((uint64_t) time(nullptr)) + ",";

  for (int i = 0; i < NUM_SENSORS; i++) {
    float tempC = sensors.getTempC(sensorAddresses[i]);

    json += "\"" + sensorNames[i] + "\": " + String(tempC) + ",";
  }

  json += "\"flow\": " + String(getFlowRate()) + ",";

  json += "\"solar_pv_array_power\": " + String(solarPvArrayPower) + ",";
  json += "\"preheat_tank_power\": " + String(solarPvArrayPower) + ",";
  json += "\"hybrid_hot_water_tank_power\": " + String(solarPvArrayPower) + "}";

  HTTPClient http;
  http.begin(URL + "/data");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("API-Key", API_KEY);
  http.POST(json);
  http.end();

  delay(5000);
}
