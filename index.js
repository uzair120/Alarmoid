// Copyright 2021 Google LLC
//
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file or at
// https://developers.google.com/open-source/licenses/bsd

const display = document.querySelector(".alarm-display");
const log = document.querySelector(".alarm-log");
const form = document.querySelector(".create-alarm");
const clearButton = document.getElementById("clear-display");

// // DOM event bindings

// // Alarm display buttons

clearButton.addEventListener("click", () => manager.cancelAllAlarms());

// New alarm form

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  let currentDate = new Date();

  // Extract form values
  const name = data["alarm-name"];
  const time = data["time-input"];
  const delayFormat = data["time-format"];

  let [hours, minutes] = time.split(":").map(Number);
  currentDate.setHours(hours, minutes, 0, 0);

  console.log(currentDate.getTime());
  // Prepare alarm info for creation call
  const alarmInfo = {};

  alarmInfo.when = currentDate.getTime();
  if (delayFormat === "ww") {
    // Specified in milliseconds, use `when` property
    alarmInfo.periodInMinutes = 10080;
  } else if (delayFormat === "dd") {
    // specified in minutes, use `delayInMinutes` property
    alarmInfo.periodInMinutes = 1440;
  }

  // Create the alarm – this uses the same signature as chrome.alarms.create
  manager.createAlarm(name, alarmInfo);
  showPage("alarmListPage");
});

class AlarmManager {
  constructor(display, log) {
    this.displayElement = display;
    this.logElement = log;

    this.logMessage("Manager: initializing demo");

    this.displayElement.addEventListener("click", this.handleCancelAlarm);
    chrome.alarms.onAlarm.addListener(this.handleAlarm);
  }

  logMessage(message) {
    const date = new Date();
    const pad = (val, len = 2) => val.toString().padStart(len, "0");
    const h = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);
    const time = `${h}:${m}:${s}.${ms}`;

    const logLine = document.createElement("div");
    logLine.textContent = `[${time}] ${message}`;

    // Log events in reverse chronological order
    this.logElement.insertBefore(logLine, this.logElement.firstChild);
  }

  handleAlarm = async (alarm) => {
    const json = JSON.stringify(alarm);
    this.logMessage(`---------Alarm "${alarm.name}" fired\n${json}}--------`);
    var opt = {
      type: "list",
      iconUrl: "./images/48.png",
      title: alarm.name,
      message: "Alarm! ",
      priority: 1,
      items: [{ message: "message", title: "title" }]
    };
    chrome.notifications.create(alarm.name, opt, function (id) {
      console.log("Last error:", chrome.runtime.lastError);
    });
    await this.refreshDisplay();
  };

  handleCancelAlarm = async (event) => {
    if (!event.target.classList.contains("alarm-row__cancel-button")) {
      return;
    }

    const name = event.target.getAttribute("data-alarm-name");
    await this.cancelAlarm(name);
    await this.refreshDisplay();
  };

  async cancelAlarm(name) {
    return chrome.alarms.clear(name, (wasCleared) => {
      if (wasCleared) {
        this.logMessage(`Manager: canceled alarm "${name}"`);
      } else {
        this.logMessage(`Manager: could not canceled alarm "${name}"`);
      }
    });
  }

  // Thin wrapper around alarms.create to log creation event
  createAlarm(name, alarmInfo) {
    chrome.alarms.create(name, alarmInfo);
    const json = JSON.stringify(alarmInfo, null, 2).replace(/\s+/g, " ");
    this.logMessage(`Created "${name}"\n${json}`);
    this.refreshDisplay();
  }

  renderAlarm(alarm, isLast) {
    const alarmEl = document.createElement("div");
    alarmEl.classList.add("alarm-list");
    alarmEl.dataset.name = alarm.name;
    alarmEl.textContent = `Name: ${alarm.name}\r\nScheduled Time: 
    ${new Date(alarm.scheduledTime).toLocaleString()}\r\nRepeation: ${
      alarm.periodInMinutes
        ? alarm.periodInMinutes === 1440
          ? "Daily"
          : "Weekly"
        : "One Time"
    }\r\n`;

    const cancelButton = document.createElement("button");
    cancelButton.classList.add("alarm-row__cancel-button");
    cancelButton.textContent = "cancel";
    cancelButton.setAttribute("data-alarm-name", alarm.name);
    const alarmEl2 = document.createElement("div");

    alarmEl2.classList.add("alarm-row__cancel-button-div");
    alarmEl2.appendChild(cancelButton);
    alarmEl.appendChild(alarmEl2);

    console.log({ alarm }, { alarmEl });
    this.displayElement.appendChild(alarmEl);
  }

  async cancelAllAlarms() {
    return chrome.alarms.clearAll((wasCleared) => {
      if (wasCleared) {
        this.logMessage(`Manager: canceled all alarms"`);
      } else {
        this.logMessage(`Manager: could not canceled all alarms`);
      }
    });
  }

  async populateDisplay() {
    return chrome.alarms.getAll((alarms) => {
      for (const [index, alarm] of alarms.entries()) {
        const isLast = index === alarms.length - 1;
        this.renderAlarm(alarm, isLast);
      }
    });
  }

  // Simple locking mechanism to prevent multiple concurrent refreshes from rendering duplicate
  // entries in the alarms list
  #refreshing = false;

  async refreshDisplay() {
    if (this.#refreshing) {
      return;
    } // refresh in progress, bail

    this.#refreshing = true; // acquire lock
    try {
      await this.clearDisplay();
      await this.populateDisplay();
    } finally {
      this.#refreshing = false; // release lock
    }
  }

  async clearDisplay() {
    this.displayElement.textContent = "";
  }
}

const manager = new AlarmManager(display, log);
manager.refreshDisplay();

document
  .getElementById("goToAddAlarm")
  .addEventListener("click", () => showPage("addAlarmPage"));
document
  .getElementById("backToListFromAdd")
  .addEventListener("click", () => showPage("alarmListPage"));
// document
//   .getElementById("backToListFromDetails")
//   .addEventListener("click", () => showPage("alarmListPage"));
// document.getElementById("submit").addEventListener("click", addAlarm);

let alarms = [];

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.style.display = "none";
  });
  document.getElementById(pageId).style.display = "block";
}

function addAlarm() {
  const name = document.getElementById("alarmName").value;
  const time = document.getElementById("alarmTime").value;
  const repeat = document.getElementById("alarmRepeat").value;

  const alarm = { name, time, repeat };
  alarms.push(alarm);

  document.getElementById("alarmForm").reset();
  showPage("alarmListPage");
  renderAlarms();
}

function renderAlarms() {
  const list = document.getElementById("alarmsList");
  list.innerHTML = ""; // Clear current list

  alarms.forEach((alarm, index) => {
    const div = document.createElement("div");
    div.textContent = `${alarm.name} - ${alarm.time}`;
    div.addEventListener("click", () => showAlarmDetails(index));
    list.appendChild(div);
  });
}

function showAlarmDetails(index) {
  const alarm = alarms[index];
  const details = document.getElementById("alarmDetails");
  details.innerHTML = `Name: ${alarm.name}<br>Time: ${alarm.time}<br>Repeat: ${alarm.repeat}`;
  showPage("alarmDetailsPage");
}

// Initially load the alarm list page
showPage("alarmListPage");

// Conditionally initialize the options.
if (!localStorage.isInitialized) {
  localStorage.isActivated = true; // The display activation.
  localStorage.frequency = 1; // The display frequency, in minutes.
  localStorage.isInitialized = true; // The option initialization.
}
