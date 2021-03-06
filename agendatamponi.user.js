// ==UserScript==
// @name         Agenda Tamponi
// @namespace    https://andreacassani.com/apps/agenda-tamponi
// @version      0.4.1
// @description  Miglioramenti per prenotazione di tamponi su progetto SOLE
// @author       Andrea Cassani
// @icon         https://i.ibb.co/88kwYf3/icon128.png
// @updateURL    https://raw.githubusercontent.com/andreacassani/Agenda-Tamponi/main/agendatamponi.meta.js
// @downloadURL  https://raw.githubusercontent.com/andreacassani/Agenda-Tamponi/main/agendatamponi.user.js
// @match        https://ws.bolognaausl.progetto-sole.it/soleweb/?wicket:interface*
// @match        https://www.progetto-sole.it/riservata*
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @grant        none
// ==/UserScript==

(function ($, undefined) {
  (function () {
    function prenotazioneTamponi() {
      let isParsed = false;
      const agende = [];
      const results = {
        0: [],
        6: [],
        14: [],
        50: [],
        98: [],
        99: [],
        100: [],
        101: [],
        999: [],
      };
      const codiciEta = [
        {
          eta: 0,
          name: "TUTTE LE ETA",
        },
        {
          eta: 6,
          name: "MAGGIORE 6 ANNI",
        },
        {
          eta: 14,
          name: "MAGGIORE 14 ANNI",
        },
        {
          eta: 50,
          name: "SCUOLE",
        },
        {
          eta: 99,
          name: "PEDIATRICI",
        },
        {
          eta: 100,
          name: "40-69 ANNI (AMB. BLU)",
        },
        {
          eta: 101,
          name: "MONOCLONALI",
        },
        {
          eta: 999,
          name: "SCONOSCIUTO",
        },
      ];

      function anticache() {
        return `${new Date().getTime()}.${Math.random()}`;
      }

      function getDate() {
        const a = new Date();
        const b = new Date();
        b.setDate(a.getDate() + 7);

        return {
          a: Math.round(a.getTime()),
          b: Math.round(b.getTime()),
        };
      }

      function addWarning() {
        const html =
          "<div id='warningLoading' style='background: none repeat scroll 0 0 #DFEBF1; padding: 1em; color: #1e364b; margin: 0.2em;'><div style='padding: 1em; border: 1px solid #7AACC5;'><div><div><b>ATTENZIONE!!</b></div><br><div><p><u>CARICAMENTO DELLE AGENDE IN CORSO...<br>Se entro 15 secondi non compaiono le agende qualcosa non ha funzionato!!</u></p><div><p id='warningText1'></p><p id='warningText2'></p><p id='warningText3'></p></div></div></div></div></div>";

        $(html).insertAfter(
          `#${$(".schede-covid")
            .eq($(".schede-covid").length - 1)
            .attr("id")}`
        );
      }

      function removeWarning() {
        $("#warningLoading").remove();
      }

      function addElements() {
        let html =
          "<div style='background: none repeat scroll 0 0 #DFEBF1; padding: 1em; color: #1e364b; margin: 0.2em;'>";

        codiciEta.forEach((key) => {
          html += `<div style='margin-top: 2em; padding: 1em; border: 1px solid ${key.eta === 101 ? '#4b371e; background-color: #f0dcc7' : '#7AACC5'};'><div id='${key.eta}'><div><b>${key.name}</b></div><div id='${key.eta}-drive' style='margin-top: 1em;'><p><u>DRIVE</u></p></div><div id='${key.eta}-tamponi' style='margin-top: 1em;'><p><u>AMBULATORI TAMPONI</u></p></div><div id='${key.eta}-dsp' style='margin-top: 1em;'><p><u>DSP</u></p></div><div id='${key.eta}-blu' style='margin-top: 1em;'><p><u>AMBULATORI BLU</u></p></div></div></div>`;
        });

        html += "</div>";

        $(html).insertAfter(
          `#${$(".schede-covid")
            .eq($(".schede-covid").length - 1)
            .attr("id")}`
        );
      }

      function getAppuntamenti(agenda, callback, retry) {
        $("#warningText2").text(
          `Invio richiesta per appuntamenti agenda ${agenda}.`
        );
        try {
          const interfaces = document.documentElement.innerHTML.match(
            /\?wicket:interface=:(\d+):(?:nuovaSchedaPanel:)?schedaPanel:formAppuntamento:(\d*):IFormSubmitListener::/
          );
          const appuntamentoButton = document.documentElement.innerHTML.match(
            /name="selezionaAppuntamentoButton".+?value="(.+?)"/
          );
          const formId = document.documentElement.innerHTML.match(
            /formAppuntamento.+input.+name="(.+?)"/
          );

          const formData = {
            [formId[1]]: "",
            strutturaRicercaAppuntamento: agenda,
            selezionaAppuntamentoButton: appuntamentoButton[1],
          };

          $.ajax({
            url: `/soleweb/?wicket:interface=:${interfaces[1]}${
              document.documentElement.innerHTML.match(/nuovaSchedaPanel/)
                ? ":nuovaSchedaPanel"
                : ""
            }:schedaPanel:formAppuntamento:${
              interfaces[2]
            }:IFormSubmitListener::`,
            method: "POST",
            data: formData,
            timeout: 15e3,
            success(data) {
              if (data.match(/login\/wicket:interface/)) {
                if (retry && retry > 2) {
                  return callback("Login error");
                }
                const retryReturn = retry ? retry + 1 : 1;
                return getAppuntamenti(agenda, callback, retryReturn);
              }

              if (data.match(/prenotazioneCalendar::IBehaviorListener/)) {
                const url = data.match(
                  /url: '\?wicket:interface=:(\d+):prenotazioneCalendar::IBehaviorListener:0:&sid=(.+?)',/
                );
                const wInterface = url[1];
                const sid = url[2];

                $.ajax({
                  url: `/soleweb/?wicket:interface=:${wInterface}:prenotazioneCalendar::IBehaviorListener:0:&sid=${sid}&start=${
                    getDate().a
                  }&end=${
                    getDate().b
                  }&timezoneOffset=-60&anticache=${anticache()}`,
                  method: "GET",
                  dataType: "json",
                  timeout: 15e3,
                  success(dataAgenda) {
                    if (dataAgenda[0] && dataAgenda[0].slot) {
                      const { descrizioneStruttura } = dataAgenda[0].slot;
                      const dataErogazione = dataAgenda[0].start;
                      return callback(null, {
                        descrizioneStruttura,
                        dataErogazione,
                        agenda,
                      });
                    }
                    return callback(null, false);
                  },
                });
              }
              return false;
            },
          });
        } catch (e) {
          return callback(e);
        }
        return false;
      }

      function parseData(name) {
        let cat = [name, "Drive"];
        let eta = 999;

        if (name.indexOf("COVID VISITA") > -1) {
          if (name.toLowerCase().indexOf("orsola") > -1)
            cat = ["Policlinico S. Orsola", "Blu"];
          if (name.toLowerCase().indexOf("budrio") > -1)
            cat = ["Ospedale di Budrio", "Blu"];
          if (name.toLowerCase().indexOf("crevalcore") > -1)
            cat = ["Crevalcore", "Blu"];
          if (name.toLowerCase().indexOf("ospedale maggiore") > -1)
            cat = ["Ospedale Maggiore", "Blu"];

          eta = 100;
        } else if (name.indexOf("COVID MONOCLONALI") > -1) {
          if (name.toLowerCase().indexOf("aosp") > -1)
            cat = ["Policlinico S. Orsola", "Blu"];
          if (name.toLowerCase().indexOf("ospedale maggiore") > -1)
            cat = ["Ospedale Maggiore", "Blu"];

          if (name.toLowerCase().indexOf("12-17") > -1)
            cat[0] += " (12-17 anni)";
          if (name.toLowerCase().indexOf(">=18") > -1)
            cat[0] += " (>= 18 anni)";

          eta = 101;
        } else {
          if (name.toLowerCase().indexOf("drive fiera") > -1)
            cat = ["Drive Fiera Bologna", "Drive"];
          if (name.toLowerCase().indexOf("drive san lazzaro") > -1)
            cat = ["Drive San Lazzaro", "Drive"];
          if (name.toLowerCase().indexOf("drive ospedale bentivoglio") > -1)
            cat = ["Drive Bentivoglio", "Drive"];
          if (name.toLowerCase().indexOf("unipol arena") > -1)
            cat = ["Drive Casalecchio", "Drive"];

          if (name.toLowerCase().indexOf("budrio") > -1)
            cat = ["Budrio", "Tamponi"];
          if (name.toLowerCase().indexOf("san pietro in casale") > -1)
            cat = ["San Pietro in Casale", "Tamponi"];
          if (name.toLowerCase().indexOf("saragozza") > -1)
            cat = ["Poliambulatorio Saragozza", "Tamponi"];
          if (name.toLowerCase().indexOf("crevalcore") > -1)
            cat = ["Crevalcore", "Tamponi"];
          if (name.toLowerCase().indexOf("ospedale maggiore") > -1)
            cat = ["Ospedale Maggiore", "Tamponi"];
          if (name.toLowerCase().indexOf("piazza rita levi montalcini") > -1)
            cat = ["Casa della Salute Casalecchio", "Tamponi"];
          if (name.toLowerCase().indexOf("porretta") > -1)
            cat = ["Porretta", "Tamponi"];
          if (name.toLowerCase().indexOf("orsola") > -1)
            cat = ["Policlinico S. Orsola", "Tamponi"];
          if (name.toLowerCase().indexOf("rizzoli") > -1)
            cat = ["Istituto Ortopedico Rizzoli", "Tamponi"];
          if (name.toLowerCase().indexOf("boldrini") > -1)
            cat = ["Boldrini", "Tamponi"];
          if (name.toLowerCase().indexOf("pieve di cento") > -1)
            cat = ["Pieve di Cento", "Tamponi"];

          if (
            name.toLowerCase().indexOf("tutte") > -1 ||
            name.toLowerCase().indexOf("aou") > -1
          )
            eta = 0;

          if (name.toLowerCase().indexOf("pediatrici") > -1) eta = 99;
          if (name.toLowerCase().indexOf("6-14 anni") > -1)
            cat[0] += " (6-14 anni)";

          if (
            name.toLowerCase().indexOf("maggiore di 6 anni") > -1 ||
            name.toLowerCase().indexOf("maggiore 6 anni") > -1
          )
            eta = 6;
          if (
            name.toLowerCase().indexOf("maggiore di 14 anni") > -1 ||
            name.toLowerCase().indexOf("maggiore 14 anni") > -1 ||
            name.toLowerCase().indexOf("adulti drive") > -1
          )
            eta = 14;
          if (
            name.toLowerCase().indexOf("screening scuola") > -1 ||
            name.toLowerCase().indexOf("personale istituti scolastici") > -1
          )
            eta = 50;
        }

        if (eta === 999) {
          console.log(name, [cat, eta]);
        }

        return {
          cat,
          eta,
        };
      }

      function startParsing() {
        $("#warningText1").text(
          `Raccolgo informazioni sulle agende. Ho trovato ${agende.length} agende.`
        );
        agende.forEach((agenda) => {
          if (!agenda.num) return;

          getAppuntamenti(agenda.num, (err, data) => {
            $("#warningText2").text(
              `Appuntamenti per l'agenda ${agenda.num} ricevuti.`
            );
            if (err) return console.log(err);
            if (data) {
              const parsed = parseData(data.descrizioneStruttura);
              return results[parsed.eta].push({
                eta: parsed.eta,
                sede: parsed.cat[0],
                tipo: parsed.cat[1],
                agenda: data.agenda,
                dataErogazione: data.dataErogazione,
                nomeCompleto: data.descrizioneStruttura,
              });
            }
            return false;
          });
        });
      }

      function cleanAgende() {
        codiciEta.forEach((key) => {
          if ($(`#${key.eta}-drive`).children().length === 1) {
            $(`#${key.eta}-drive`).remove();
          }
          if ($(`#${key.eta}-tamponi`).children().length === 1) {
            $(`#${key.eta}-tamponi`).remove();
          }
          if ($(`#${key.eta}-dsp`).children().length === 1) {
            $(`#${key.eta}-dsp`).remove();
          }
          if ($(`#${key.eta}-blu`).children().length === 1) {
            $(`#${key.eta}-blu`).remove();
          }
          if ($(`#${key.eta}`).children().length === 1) {
            $(`#${key.eta}`).parent().remove();
          }
        });
      }

      function startExtension() {
        $("#startExtension").attr("disabled", true);

        if (isParsed) {
          alert(
            "Richiesta in corso o già completata, attendi o ricarica la pagina."
          );
        } else {
          isParsed = true;
          addWarning();
          startParsing();
        }
      }

      $(document).ajaxStop(() => {
        $("#warningText3").text(
          "Tutte le agende sono state valutate. Mostro i risultati."
        );
        removeWarning();
        addElements();
        Object.keys(results).forEach((key) => {
          let result = results[key];
          result = result.sort((a, b) =>
            a.sede > b.sede ? 1 : b.sede > a.sede ? -1 : 0
          );
          result.forEach((entry) => {
            const parsedDataErogazione = new Intl.DateTimeFormat("it").format(
              new Date(entry.dataErogazione)
            );
            $(
              `<p onclick="$('select[name=strutturaRicercaAppuntamento]').val(${entry.agenda}); document.getElementsByName('strutturaRicercaAppuntamento')[0].scrollIntoView({ behavior: 'smooth', block: 'center' });"><span title="${entry.nomeCompleto}" style='color: blue; text-decoration: underline; cursor: pointer'> • ${entry.sede}: ${parsedDataErogazione}</span></p>`
            ).appendTo(`#${entry.eta}-${entry.tipo.toLowerCase()}`);
          });
        });

        cleanAgende();
      });

      $(
        '<input class="button" type="button" id="startExtension" value="Prenotazione semplificata">'
      )
        .click(() => {
          startExtension();
        })
        .insertAfter($("[name=selezionaAppuntamentoButton]"));

      $("select[name=strutturaRicercaAppuntamento] option").each((a, b) => {
        agende.push({
          num: $(b).val(),
          text: $(b).text(),
        });
      });
    }

    function agendaTamponiMenu() {
      function createDivMenu() {
        const covidHtml = `
            		<li class="menu_expanded">
            			<a href="" class="menuToggle"><span>Gestione malattia (funziona solo se si ha accesso a servizi COVID)</span></a>
            			<ul class="">
            				<li class="">
            					<a href="https://ws.bolognaausl.progetto-sole.it/soleweb/login?wicket:bookmarkablePage=:it.cup2000.soleweb.covid19.page.NuovaSchedaCovidPage" title="Nuova scheda"><span>Nuova denuncia malattia</span></a>
            				</li>
            				<li class="">
            					<a href="https://ws.bolognaausl.progetto-sole.it/soleweb/login?wicket:bookmarkablePage=:it.cup2000.soleweb.covid19.page.CercaSchedaCovidPage" title="Elenco schede"><span>Elenco schede denuncia</span></a>
            				</li>
            				<li class="">
            					<a href="https://ws.bolognaausl.progetto-sole.it/soleweb/login?wicket:bookmarkablePage=:it.cup2000.soleweb.covid19.page.guarigione.NuovaSchedaGuarigionePage" title="Nuova scheda Guarigione"><span>Nuova guarigione</span></a>
            				</li>
            				<li class="">
            					<a href="https://ws.bolognaausl.progetto-sole.it/soleweb/login?wicket:bookmarkablePage=:it.cup2000.soleweb.covid19.page.guarigione.CercaSchedaGuarigionePage" title="Elenco schede Guarigione"><span>Elenco schede guarigione</span></a>
            				</li>
            			</ul>
            		</li>`;

        $("#top_cvd19").html(covidHtml);
      }

      function createTempDivMenu() {
        const covidHtml = `
            		<div class="box-sx-bottom">&nbsp;</div>
            		<div class="box-sx cvd19">
            			<div>
            				<h2>COVID-19
            					<a href="" onclick="expandCollapse('top_cvd19'); return false;">
            					<img id="cvd19" src="/styles/img/arrow-int.gif" alt="Menu COVID-19">
            					</a>
            				</h2>
            				<ul class="raggruppamento" id="top_cvd19">
            					<p>Caricamento in corso...</p>
            				</ul>
            			</div>
            		</div>`;

        $(".box-sx.prf").after(covidHtml);
      }

      function createiFrame() {
        $('<iframe src="/servizi/index.php"></iframe>')
          .insertAfter("body")
          .hide()
          .on("load", () => {
            createDivMenu();
          });
      }

      createTempDivMenu();
      createiFrame();
    }

    if (
      window.location.href.match(
        /^https:\/\/www\.progetto-sole\.it\/riservata.*$/
      )
    )
      agendaTamponiMenu();
    if (
      window.location.href.match(
        /^https:\/\/ws\.bolognaausl\.progetto-sole\.it\/soleweb\/\?wicket:interface.*$/
      )
    )
      prenotazioneTamponi();
  })();
})(window.jQuery.noConflict(true));
