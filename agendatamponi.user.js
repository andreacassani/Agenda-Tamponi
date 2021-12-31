// ==UserScript==
// @name         Agenda Tamponi
// @namespace    https://andreacassani.com/apps/agenda-tamponi
// @version      0.5.4
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
      let IS_PARSED = false;

      const AGENDE = [];
      const BATCH_TIME = 75;
      const PARSE_RANGE_DAYS = 14;
      const CODICI_ETA = [
        "SCONOSCIUTO",
        "TUTTE LE ETA",
        "MAGGIORE 6 ANNI",
        "MAGGIORE 14 ANNI",
        "SCUOLE",
        "PEDIATRICI",
        "40-69 ANNI (AMB. BLU)",
        "MONOCLONALI",
      ];
      const TIPI = {
        Sconosciuto: "Sconosciuto",
        Blu: "Ambulatorio Blu",
        Drive: "Drive Tamponi",
        Tamponi: "Ambulatorio Tamponi",
      };

      function anticache() {
        return `${new Date().getTime()}.${Math.random()}`;
      }

      function getDate() {
        const a = new Date();
        const b = new Date();
        b.setDate(a.getDate() + PARSE_RANGE_DAYS);

        return {
          start: Math.round(a.getTime()),
          end: Math.round(b.getTime()),
        };
      }

      function sortList(selector, child) {
        const parent = $(selector);

        parent
          .find(child)
          .sort(function (a, b) {
            var upA = $(a).text().toUpperCase();
            var upB = $(b).text().toUpperCase();

            return upA < upB ? -1 : upA > upB ? 1 : 0;
          })
          .appendTo(selector);
      }

      function getAppuntamenti(agenda, callback, retry = 0) {
        const numero = agenda.numero;
        const nome = agenda.nome;

        if ($(`#status-agenda-${numero}`).length === 0) {
          $("#warningText2").append(
            `<p id="status-agenda-${numero}">[...] Agenda ${nome}</p>`
          );
        }

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
            strutturaRicercaAppuntamento: numero,
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
            method: "post",
            data: formData,
            timeout: 30000,
            error: function (_, status) {
              if (status === "timeout") {
                if (retry > 2) {
                  callback("timeout", { agenda });
                } else {
                  getAppuntamenti(agenda, callback, ++retry);
                }
              } else {
                callback(status, { agenda });
              }
            },
            success: function (html) {
              if (html.match(/login\/wicket:interface/)) {
                if (retry > 2) {
                  callback("login_error", { agenda });
                } else {
                  getAppuntamenti(agenda, callback, ++retry);
                }
              }

              if (html.match(/prenotazioneCalendar::IBehaviorListener/)) {
                const url = html.match(
                  /url: '\?wicket:interface=:(\d+):prenotazioneCalendar::IBehaviorListener:0:&sid=(.+?)',/
                );
                const wInterface = url[1];
                const sid = url[2];

                $.ajax({
                  url: `/soleweb/?wicket:interface=:${wInterface}:prenotazioneCalendar::IBehaviorListener:0:&sid=${sid}&start=${
                    getDate().start
                  }&end=${
                    getDate().end
                  }&timezoneOffset=-60&anticache=${anticache()}`,
                  method: "get",
                  dataType: "json",
                  timeout: 30000,
                  error: function (_, status) {
                    if (status === "timeout") {
                      if (retry > 2) {
                        callback("timeout", { agenda });
                      } else {
                        getAppuntamenti(agenda, callback, ++retry);
                      }
                    } else {
                      callback(status, { agenda });
                    }
                  },
                  success: function (json) {
                    if (json[0] && json[0].slot) {
                      let slotHaTempoInRange = false;
                      let indexPrimoSlot = 0;

                      for (let i = 0; i < json.length; i++) {
                        const testDataErogazione = json[i].start;
                        const testOraAppuntamento = new Date(
                          testDataErogazione
                        ).getHours();

                        if (testOraAppuntamento < 8) {
                          continue;
                        } else {
                          slotHaTempoInRange = true;
                          indexPrimoSlot = i;
                          break;
                        }
                      }

                      if (!slotHaTempoInRange) {
                        return callback("illegal_time", { agenda });
                      }

                      const descrizioneStruttura =
                        json[indexPrimoSlot].slot.descrizioneStruttura;
                      const dataErogazione = json[indexPrimoSlot].start;
                      const primoAppuntamento = `${new Date(
                        dataErogazione
                      ).getHours()}:${String(
                        new Date(dataErogazione).getMinutes()
                      ).padStart(2, "0")}`;

                      callback(null, {
                        descrizioneStruttura,
                        dataErogazione,
                        primoAppuntamento,
                        agenda,
                      });
                    } else {
                      callback("no_slot_range", { agenda });
                    }
                  },
                });
              } else {
                callback("no_match", { agenda });
              }
            },
          });
        } catch (error) {
          callback(error, { agenda });
        }
      }

      function parseData(name) {
        const cleanName = name
          .toLowerCase()
          .trim()
          .replace(/\s\s+/g, " ")
          .replace(/\s/g, " ");

        let cat = [cleanName, "Sconosciuto"];
        let eta = 0;

        if (cleanName.indexOf("covid visita") > -1) {
          if (cleanName.indexOf("orsola") > -1) {
            cat = ["Policlinico S. Orsola", "Blu"];
          }

          if (cleanName.indexOf("budrio") > -1) {
            cat = ["Ospedale di Budrio", "Blu"];
          }

          if (cleanName.indexOf("crevalcore") > -1) {
            cat = ["Crevalcore", "Blu"];
          }

          if (cleanName.indexOf("ospedale maggiore") > -1) {
            cat = ["Ospedale Maggiore", "Blu"];
          }

          eta = 6;
        } else if (cleanName.indexOf("covid monoclonali") > -1) {
          if (cleanName.indexOf("aosp") > -1) {
            cat = ["Policlinico S. Orsola", "Blu"];
          }

          if (cleanName.indexOf("ospedale maggiore") > -1) {
            cat = ["Ospedale Maggiore", "Blu"];
          }

          if (cleanName.indexOf("12-17") > -1) {
            cat[0] += " (12-17 anni)";
          }

          if (cleanName.indexOf(">=18") > -1) {
            cat[0] += " (>= 18 anni)";
          }

          eta = 7;
        } else {
          if (cleanName.indexOf("drive fiera") > -1) {
            cat = ["Drive Fiera Bologna", "Drive"];
          }

          if (cleanName.indexOf("drive san lazzaro") > -1) {
            cat = ["Drive San Lazzaro", "Drive"];
          }

          if (cleanName.indexOf("drive san camillo") > -1) {
            cat = ["Drive San Lazzaro", "Drive"];
          }

          if (cleanName.indexOf("drive ospedale bentivoglio") > -1) {
            cat = ["Drive Bentivoglio", "Drive"];
          }

          if (cleanName.indexOf("unipol arena") > -1) {
            cat = ["Drive Casalecchio", "Drive"];
          }

          if (
            cleanName.indexOf("drive pronto soccorso ospedale di bazzano") > -1
          ) {
            cat = ["Drive Bazzano", "Drive"];
          }

          if (cleanName.indexOf("drive pala yuri") > -1) {
            cat = ["Drive San Lazzaro", "Drive"];
          }

          if (cleanName.indexOf("drive via toscana") > -1) {
            cat = ["Drive Zola Predosa", "Drive"];
          }

          if (cleanName.indexOf("drive cds ozzano") > -1) {
            cat = ["Drive Ozzano", "Drive"];
          }

          if (cleanName.indexOf("drive parco nord") > -1) {
            cat = ["Drive Parco Nord", "Drive"];
          }

          if (cleanName.indexOf("budrio") > -1) {
            cat = ["Budrio", "Tamponi"];
          }

          if (cleanName.indexOf("san pietro in casale") > -1) {
            cat = ["San Pietro in Casale", "Tamponi"];
          }

          if (cleanName.indexOf("saragozza") > -1) {
            cat = ["Poliambulatorio Saragozza", "Tamponi"];
          }

          if (cleanName.indexOf("crevalcore") > -1) {
            cat = ["Crevalcore", "Tamponi"];
          }

          if (cleanName.indexOf("ospedale maggiore") > -1) {
            cat = ["Ospedale Maggiore", "Tamponi"];
          }

          if (cleanName.indexOf("piazza rita levi montalcini") > -1) {
            cat = ["Casa della Salute Casalecchio", "Tamponi"];
          }

          if (cleanName.indexOf("porretta") > -1) {
            cat = ["Porretta", "Tamponi"];
          }

          if (cleanName.indexOf("orsola") > -1) {
            cat = ["Policlinico S. Orsola", "Tamponi"];
          }

          if (cleanName.indexOf("rizzoli") > -1) {
            cat = ["Istituto Ortopedico Rizzoli", "Tamponi"];
          }

          if (cleanName.indexOf("boldrini") > -1) {
            cat = ["Boldrini", "Tamponi"];
          }

          if (cleanName.indexOf("pieve di cento") > -1) {
            cat = ["Pieve di Cento", "Tamponi"];
          }

          if (cleanName.indexOf("vado tamponi") > -1) {
            cat = ["Vado", "Tamponi"];
          }

          if (cleanName.indexOf("ospedale bellaria pad tinozzi") > -1) {
            cat = ["Ospedale Bellaria", "Tamponi"];
          }

          if (cleanName.indexOf("baricella tamponi") > -1) {
            cat = ["Baricella", "Tamponi"];
          }

          if (
            cleanName.indexOf("tutte") > -1 ||
            cleanName.indexOf("aou") > -1
          ) {
            eta = 1;
          }

          if (cleanName.indexOf("pediatrici") > -1) {
            eta = 5;
          }

          if (cleanName.indexOf("6-14 anni") > -1) {
            cat[0] += " (6-14 anni)";
          }

          if (
            cleanName.indexOf("maggiore di 6 anni") > -1 ||
            cleanName.indexOf("maggiore 6 anni") > -1
          ) {
            eta = 2;
          }

          if (
            cleanName.indexOf("maggiore di 14 anni") > -1 ||
            cleanName.indexOf("maggiore 14 anni") > -1 ||
            cleanName.indexOf("adulti drive") > -1
          ) {
            eta = 3;
          }

          if (
            cleanName.indexOf("screening scuola") > -1 ||
            cleanName.indexOf("personale istituti scolastici") > -1
          ) {
            eta = 4;
          }
        }

        if (eta === 0) {
          console.log(cleanName, [cat, eta]);
        }

        return {
          cat,
          eta,
        };
      }

      function startParsing() {
        $("#warningText1").html(
          `Ho trovato ${AGENDE.length} agende. Clicca su <i>Dettagli</i> per vedere il progresso.<br>Mano a mano che le agende vengono caricate saranno mostrate in calce alla pagina.`
        );

        const warningHtml =
          "<div style='background: none repeat scroll 0 0 #DFEBF1; padding: 1em; color: #1e364b; margin: 0.2em;' id='agende-covid'></div>";

        $(warningHtml).insertAfter(`#warningLoading`);

        AGENDE.forEach(function (agenda, index) {
          const numero = agenda.numero;

          if (!numero) {
            return console.log(agenda);
          }

          setTimeout(function () {
            getAppuntamenti(agenda, function (error, data) {
              const color = error ? "993123" : data ? "379923" : "997a23";
              const status = error ? "errore" : data ? "ok" : "vuota";

              $(`#status-agenda-${data.agenda.numero}`).html(
                `<span style="color: #${color}">[${status}] Agenda ${data.agenda.nome}</span>`
              );

              if (error) {
                return console.log(error, agenda);
              }

              if (data) {
                const parsedData = parseData(data.descrizioneStruttura);

                const item = {
                  eta: parsedData.eta,
                  sede: parsedData.cat[0],
                  tipo: parsedData.cat[1],
                  agenda: data.agenda,
                  dataErogazione: data.dataErogazione,
                  nomeCompleto: data.descrizioneStruttura,
                  primoAppuntamento: data.primoAppuntamento,
                };

                if ($(`#${item.eta}`).length === 0) {
                  const background =
                    item.eta === 7
                      ? "#4b371e; background-color: #f0dcc7"
                      : "#7AACC5";

                  const outerHtml = `<div style='margin-top: 2em; padding: 1em; border: 1px solid ${background};' class="agenda-titolo"><div id='${
                    item.eta
                  }'><div><span><b>${
                    CODICI_ETA[item.eta]
                  }</b></span></div></div>`;

                  $(outerHtml).appendTo("#agende-covid");
                }

                if ($(`#${item.eta}-${item.tipo}`).length === 0) {
                  const typeHtml = `<div id='${item.eta}-${
                    item.tipo
                  }' style='margin-top: 1em;'><p><u>${
                    TIPI[item.tipo]
                  }</u></p></div>`;
                  $(typeHtml).appendTo(`#${item.eta}`);
                }

                if ($(`#agenda-item-${item.agenda.numero}`).length === 0) {
                  const parsedDataErogazione = new Intl.DateTimeFormat(
                    "it"
                  ).format(new Date(item.dataErogazione));

                  const agendaHtml = `<p id="agenda-item-${item.agenda.numero}" onclick="$('select[name=strutturaRicercaAppuntamento]').val(${item.agenda.numero}); document.getElementsByName('strutturaRicercaAppuntamento')[0].scrollIntoView({ behavior: 'smooth', block: 'center' });"><span>• </span><span title="${item.nomeCompleto}" style='color: blue; text-decoration: underline; cursor: pointer'>${item.sede}: ${parsedDataErogazione} (${item.primoAppuntamento})</span></p>`;

                  $(agendaHtml).appendTo(`#${item.eta}-${item.tipo}`);
                }

                sortList(`#${item.eta}-${item.tipo}`, "p");
                sortList("#agende-covid", ".agenda-titolo");
              }
            });
          }, index * BATCH_TIME);
        });
      }

      function addWarning() {
        const html =
          "<div id='warningLoading' style='background: none repeat scroll 0 0 #DFEBF1; padding: 1em; color: #1e364b; margin: 0.2em;'><div style='padding: 1em; border: 1px solid #7AACC5;'><div><div><b>PRENOTAZIONE SEMPLIFICATA</b></div><br><div><p>L'applicazione ha caricato le agende.</p><div><p id='warningText1'></p><div id='status.dettagli'><p onClick='$(\"#warningText2\").slideToggle(\"slow\");' style='cursor: pointer;'>► <u>Visualizza dettagli</u></p><p id='warningText2' style='display: none;'></p></div></div></div></div></div></div>";

        $(html).insertAfter(
          `#${$(".schede-covid")
            .eq($(".schede-covid").length - 1)
            .attr("id")}`
        );
      }

      function startExtension() {
        $("#startExtension").attr("disabled", true);

        if (IS_PARSED) {
          alert(
            "Richiesta in corso o già completata, attendi o ricarica la pagina."
          );
        } else {
          IS_PARSED = true;
          addWarning();
          startParsing();
        }
      }

      const prenotazioneSemplificataButton = $(
        '<input class="button" type="button" id="startExtension" value="Prenotazione semplificata">'
      );

      prenotazioneSemplificataButton.click(function () {
        startExtension();
      });

      prenotazioneSemplificataButton.insertAfter(
        $("[name=selezionaAppuntamentoButton]")
      );

      $("select[name=strutturaRicercaAppuntamento] option").each(function (
        _,
        item
      ) {
        AGENDE.push({
          numero: $(item).val(),
          nome: $(item).text(),
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
          .on("load", function () {
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
    ) {
      agendaTamponiMenu();
    }

    if (
      window.location.href.match(
        /^https:\/\/ws\.bolognaausl\.progetto-sole\.it\/soleweb\/\?wicket:interface.*$/
      )
    ) {
      prenotazioneTamponi();
    }
  })();
})(window.jQuery.noConflict(true));
