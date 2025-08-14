const labelConfig = [
  { len: 6, text: "地区码" },
  { len: 8, text: "出生日期" },
  { len: 3, text: "顺序码" },
  { len: 1, text: "校验码" },
];
const groupsWrap = document.getElementById("id-groups-wrap");
let inputs = [],
  inputIdx = 0;
labelConfig.forEach((g) => {
  const box = document.createElement("div");
  box.className = "id-group-box";
  box.innerHTML = `<div class="id-label">${g.text}</div>`;
  const groupDiv = document.createElement("div");
  groupDiv.className = "id-input-group";
  for (let i = 0; i < g.len; i++) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.maxLength = 1;
    inp.className = "id-input";
    inp.inputMode = inputIdx === 17 ? "text" : "numeric";
    inp.autocomplete = "off";
    inp.dataset.idx = inputIdx;
    groupDiv.appendChild(inp);
    inputs.push(inp);
    inputIdx++;
  }
  box.appendChild(groupDiv);
  groupsWrap.appendChild(box);
});
let areaMap = {};
fetch("data.json")
  .then((r) => r.json())
  .then((d) => {
    areaMap = d;
    update();
  });
function calcCheckCode(id17) {
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2],
    c = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];
  let sum = 0,
    steps = [];
  for (let i = 0; i < 17; i++) {
    let n = +id17[i],
      s = n * w[i];
    sum += s;
    steps.push({ n, w: w[i], s });
  }
  return { code: c[sum % 11], steps, sum, mod: sum % 11 };
}
function checkBirthDate(vals) {
  const y = vals.slice(6, 10).join(""),
    m = vals.slice(10, 12).join(""),
    d = vals.slice(12, 14).join("");
  if (y.length !== 4 || m.length !== 2 || d.length !== 2)
    return { valid: false, msg: "出生日期不完整" };
  const yy = +y,
    mm = +m,
    dd = +d;
  if (isNaN(yy) || isNaN(mm) || isNaN(dd))
    return { valid: false, msg: "出生日期格式错误" };
  if (mm < 1 || mm > 12) return { valid: false, msg: "月份无效" };
  const days = [
    31,
    (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (dd < 1 || dd > days[mm - 1]) return { valid: false, msg: "日期无效" };
  const now = new Date(),
    inputDate = new Date(yy, mm - 1, dd),
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (inputDate > today) return { valid: false, msg: "出生日期不能晚于今天" };
  if (yy < 1900 || yy > now.getFullYear())
    return { valid: false, msg: "年份不合理" };
  return { valid: true, msg: `${y}-${m}-${d}` };
}
function renderStepTable(vals, code, steps, sum, mod) {
  let html = '<div class="step-table-wrap"><table class="step-table">';
  html +=
    "<tr><th>位</th>" +
    [...Array(17)].map((_, i) => `<th>${i + 1}</th>`).join("") +
    "</tr>";
  html +=
    "<tr><th>数字</th>" +
    [...Array(17)]
      .map(
        (_, i) => `<td${vals[i] ? "" : ' class="fail"'}>${vals[i] || ""}</td>`
      )
      .join("") +
    "</tr>";
  html +=
    "<tr><th>权重</th>" +
    [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
      .map((w) => `<td>${w}</td>`)
      .join("") +
    "</tr>";
  html +=
    "<tr><th>乘积</th>" +
    steps
      .map(
        (s, i) =>
          `<td${vals[i] ? "" : ' class="fail"'}>${vals[i] ? s.s : ""}</td>`
      )
      .join("") +
    "</tr>";
  html += `<tr><th>求和</th><td colspan="17" style="text-align:left;">${
    steps.length === 17
      ? steps.map((s) => s.s).join(" + ") + " = <b>" + sum + "</b>"
      : ""
  }</td></tr>`;
  html += `<tr><th>取模11</th><td colspan="17" style="text-align:left;">${
    steps.length === 17 ? sum + " % 11 = <b>" + mod + "</b>" : ""
  }</td></tr>`;
  html += `<tr><th>校验码</th><td colspan="17" style="text-align:left;">${
    steps.length === 17 ? code : ""
  }</td></tr>`;
  html += "</table></div>";
  return html;
}
function update() {
  let vals = inputs.map((inp) => inp.value.toUpperCase());
  for (let i = 0; i < 18; i++) {
    if (i < 17) {
      if (!/^\d$/.test(vals[i])) vals[i] = "";
    } else {
      if (!/^\d|X$/.test(vals[i])) vals[i] = "";
    }
    inputs[i].value = vals[i];
  }
  let areaCode = vals.slice(0, 6).join(""),
    areaValid = areaCode.length === 6 && !!areaMap[areaCode];
  for (let i = 0; i < 6; i++)
    inputs[i].classList.toggle(
      "error",
      areaCode.length === 6 && !areaValid && vals[i]
    );
  let birthCheck = null,
    birthValid = false;
  if (vals.slice(6, 14).every((v) => v.length === 1)) {
    birthCheck = checkBirthDate(vals);
    birthValid = birthCheck.valid;
    for (let i = 6; i < 14; i++)
      inputs[i].classList.toggle("error", !birthValid && vals[i]);
  } else for (let i = 6; i < 14; i++) inputs[i].classList.remove("error");
  let filled17 = vals.slice(0, 17).every((v) => v.length === 1),
    info = "",
    stepHtml = "";
  if (areaCode.length === 6)
    stepHtml += areaValid
      ? `<div>地区码 <b>${areaCode}</b>：${areaMap[areaCode]}</div>`
      : `<div style="color:#e00">地区码无效：<b>${areaCode}</b></div>`;
  if (vals.slice(6, 14).every((v) => v.length === 1))
    stepHtml += `<div>出生日期 <b>${vals.slice(6, 14).join("")}</b>：${
      birthCheck.valid
        ? `<span style="color:#2a9d2e;">${birthCheck.msg}</span>`
        : `<span style="color:#e00">${birthCheck.msg}</span>`
    }</div>`;
  if (filled17) {
    let { code, steps, sum, mod } = calcCheckCode(vals.slice(0, 17).join(""));
    stepHtml += renderStepTable(vals, code, steps, sum, mod);
    if (!vals[17]) {
      inputs[17].classList.remove("user-input", "error");
      info = "请填写最后一位校验码";
    } else {
      inputs[17].classList.add("user-input");
      if (vals[17] === code && areaValid && birthValid) {
        inputs[17].classList.remove("error");
        info = '<span class="ok">身份证号码有效</span>';
      } else {
        inputs[17].classList.add("error");
        if (areaCode.length === 6 && !areaValid)
          info = '<span class="fail">地区码无效，请检查前六位</span>';
        else if (birthCheck && !birthCheck.valid)
          info = '<span class="fail">出生日期无效，请检查第7-14位</span>';
        else info = '<span class="fail">校验码错误，请核对输入</span>';
      }
    }
  } else {
    inputs[17].value = "";
    inputs[17].classList.remove("user-input", "error");
    info = "请输入完整身份证号码，系统将自动校验";
  }
  document.getElementById("check-info").innerHTML = info;
  document.getElementById("check-step").innerHTML = stepHtml;
}
inputs.forEach((inp, idx) => {
  inp.addEventListener("input", (e) => {
    let v = inp.value.toUpperCase();
    if (idx < 17 && !/^\d$/.test(v)) inp.value = "";
    if (idx === 17 && !/^\d|X$/.test(v)) inp.value = "";
    if (inp.value && idx < 17) inputs[idx + 1].focus();
    update();
  });
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !inp.value && idx > 0) inputs[idx - 1].focus();
  });
  inp.addEventListener("focus", update);
});
update();
