(function () {
  if (document.querySelector("[data-iman-frame-translator]")) return;

  var marker = document.createElement("div");
  marker.setAttribute("data-iman-frame-translator", "true");
  marker.id = "google_translate_element_frame";
  marker.setAttribute("aria-hidden", "true");
  marker.style.display = "none";
  document.body.appendChild(marker);

  var translationStyles = document.createElement("style");
  translationStyles.textContent =
    "#google_translate_element_frame,.goog-te-banner-frame,.goog-te-balloon-frame,.VIpgJd-ZVi9od-ORHb-OEVmcd,body>iframe.skiptranslate,#goog-gt-tt{display:none!important}" +
    "html,body{top:0!important}";
  document.head.appendChild(translationStyles);

  window.googleTranslateElementInitFrame = function () {
    if (!window.google || !window.google.translate) return;
    new window.google.translate.TranslateElement(
      {
        pageLanguage: "en",
        includedLanguages: "en,ht,es",
        autoDisplay: false
      },
      "google_translate_element_frame"
    );
  };

  var translateScript = document.createElement("script");
  translateScript.src =
    "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInitFrame";
  translateScript.async = true;
  document.body.appendChild(translateScript);
})();
