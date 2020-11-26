// ==UserScript==
// @name         Agenda Tamponi
// @namespace    https://andreacassani.com/apps/agendatamponi
// @version      0.1
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

(function() {
    'use strict';

    function prenotazioneTamponi() {
        let isParsed = false;
        let agende = [];
        let results = {
            0: [],
            6: [],
            14: [],
            50: [],
            99: [],
            100: [],
            101: []
        };



        function startExtension() {
            $("#startExtension").attr("disabled", true);

            if (isParsed) {
                alert("Richiesta in corso o già completata, attendi o ricarica la pagina.");
            } else {
                isParsed = true;
                addWarning();
                startParsing();
            }
        }

        function addWarning() {
            let html = "<div id='warningLoading' style='background: none repeat scroll 0 0 #DFEBF1; padding: 1em; color: #1e364b; margin: 0.2em;'><div style='padding: 1em; border: 1px solid #7AACC5;'><div><div><b>ATTENZIONE!!</b></div><br><div><p><u>CARICAMENTO DELLE AGENDE IN CORSO...<br>Se entro 15 secondi non compaiono le agende qualcosa non ha funzionato!!</u></p><div><p id='warningText1'></p><p id='warningText2'></p><p id='warningText3'></p></div></div></div></div></div>";

            $(html).insertAfter("#" + $(".schede-covid").eq($(".schede-covid").length - 1).attr("id"));
        }

        function removeWarning() {
            $("#warningLoading").remove();
        }

        function addElements() {
            let html = "<div style='background: none repeat scroll 0 0 #DFEBF1; padding: 1em; color: #1e364b; margin: 0.2em;'>";

            [{
                eta: 0,
                name: "TUTTE LE ETA"
            }, {
                eta: 6,
                name: "MAGGIORE 6 ANNI"
            }, {
                eta: 14,
                name: "MAGGIORE 14 ANNI"
            }, {
                eta: 99,
                name: "PEDIATRICI"
            }, {
                eta: 50,
                name: "SCUOLE"
            }, {
                eta: 100,
                name: "14-60 ANNI"
            }, {
                eta: 101,
                name: "SCONOSCIUTO"
            }].forEach(function(key) {
                //console.log(key);

                html += "<div style='margin-top: 2em; padding: 1em; border: 1px solid #7AACC5;'><div id='" + key.eta + "'><div><b>" + key.name + "</b></div><br><div id='" + key.eta + "-drive'><p><u>DRIVE</u></p></div><div id='" + key.eta + "-tamponi'><p><u><br>AMBULATORI TAMPONI</u></p></div><div id='" + key.eta + "-dsp'><p><u><br>DSP</u></p></div><div id='" + key.eta + "-blu'><p><u><br>AMBULATORI BLU</u></p></div></div></div>";
            });

            html += "</div>";

            $(html).insertAfter("#" + $(".schede-covid").eq($(".schede-covid").length - 1).attr("id"));
        }

        function getAppuntamenti(agenda, callback, retry) {
            $("#warningText2").text("Invio richiesta per appuntamenti agenda " + agenda + ".");
            try {
                let interfaces = document.documentElement.innerHTML.match(/\?wicket:interface=:(\d+):(?:nuovaSchedaPanel:)?schedaPanel:formAppuntamento:(\d*):IFormSubmitListener::/);
                let appuntamentoButton = document.documentElement.innerHTML.match(/name="selezionaAppuntamentoButton".+?value="(.+?)"/);
                let formId = document.documentElement.innerHTML.match(/formAppuntamento.+input type="hidden" name="(.+?)"/);

                let formData = {
                    [formId[1]]: "",
                    "strutturaRicercaAppuntamento": agenda,
                    "selezionaAppuntamentoButton": appuntamentoButton[1]
                }

                $.ajax({
                    url: "/soleweb/?wicket:interface=:" + interfaces[1] + (document.documentElement.innerHTML.match(/nuovaSchedaPanel/) ? ":nuovaSchedaPanel" : "") + ":schedaPanel:formAppuntamento:" + interfaces[2] + ":IFormSubmitListener::",
                    method: "POST",
                    data: formData,
                    timeout: 15e3,
                    success: function(data) {
                        //console.log(agenda, data);
                        if (data.match(/login\/wicket:interface/)) {
                            //console.log("Riprovo agenda " + agenda + " (" + (retry ? ++retry : 1) + ")");
                            if (retry && retry > 2) {
                                return callback("Login error");
                            } else {
                                return getAppuntamenti(agenda, callback, (retry ? ++retry : 1));
                            }
                        }

                        if (data.match(/prenotazioneCalendar\:\:IBehaviorListener/)) {
                            let url = data.match(/url\: \'\?wicket\:interface\=\:(\d+)\:prenotazioneCalendar\:\:IBehaviorListener\:0\:\&sid\=(.+?)\'\,/);
                            let wInterface = url[1],
                                sid = url[2];

                            //console.log(interface, sid);

                            $.ajax({
                                url: "/soleweb/?wicket:interface=:" + wInterface + ":prenotazioneCalendar::IBehaviorListener:0:&sid=" + sid + "&start=" + getDate().a + "&end=" + getDate().b + "&timezoneOffset=-60&anticache=" + anticache(),
                                method: "GET",
                                dataType: "json",
                                timeout: 15e3,
                                success: function(data) {
                                    //console.log(data);
                                    if (data[0] && data[0].slot) {
                                        let descrizioneStruttura = data[0].slot.descrizioneStruttura;
                                        let dataErogazione = data[0].start
                                        callback(null, {
                                            descrizioneStruttura,
                                            dataErogazione,
                                            agenda
                                        });
                                    } else {
                                        callback(null, false);
                                    }
                                }
                            });
                        }
                    }
                });
            } catch (e) {
                return callback(e);
            }
        }

        function parseData(name) {
            let cat = [name, "Drive"],
                eta = 101;

            if (name.indexOf("BASSA") > -1) {
                if (name.indexOf("Orsola") > -1) cat = ["Policlinico S. Orsola", "Blu"];
                if (name.indexOf("Budrio") > -1) cat = ["Ospedale di Budrio", "Blu"];
                if (name.indexOf("Crevalcore") > -1) cat = ["Crevalcore", "Blu"];
                if (name.indexOf("Maggiore") > -1) cat = ["Ospedale Maggiore", "Blu"];

                eta = 100;
            } else {
                if (name.indexOf("Drive San Lazzaro") > -1) cat = ["Drive San Lazzaro", "Drive"];
                if (name.indexOf("Poliambulatorio Saragozza") > -1) cat = ["Poliambulatorio Saragozza", "Tamponi"];
                if (name.indexOf("Crevalcore") > -1) cat = ["Crevalcore", "Tamponi"];
                if (name.indexOf("Budrio") > -1) cat = ["Budrio", "Tamponi"];
                if (name.indexOf("Casa della Salute Casalecchio") > -1) cat = ["Casa della Salute Casalecchio", "Tamponi"];
                if (name.indexOf("Boldrini") > -1) cat = ["Boldrini", "DSP"];
                if (name.indexOf("Ospedale Maggiore") > -1) cat = ["Ospedale Maggiore", "Tamponi"];
                if (name.indexOf("DRIVE Ospedale Bentivoglio") > -1) cat = ["Drive Bentivoglio", "Drive"];
                if (name.indexOf("PORRETTA") > -1) cat = ["Porretta", "Tamponi"];
                if (name.indexOf("Drive Fiera") > -1) cat = ["Drive Fiera Bologna", "Drive"];
                if (name.indexOf("UNIPOL ARENA Via Gino Cervi") > -1) cat = ["Drive Casalecchio", "Drive"];
                if (name.indexOf("Policlinico") > -1) cat = ["Policlinico S. Orsola", "Tamponi"];

                if (name.indexOf("TUTTE") > -1 || name.indexOf("AOU") > -1) eta = 0;
                if (name.indexOf("PEDIATRICI") > -1) eta = 99;
                if (name.indexOf("maggiore di 6 anni") > -1 || name.indexOf("maggiore 6 anni") > -1) eta = 6;
                if (name.indexOf("maggiore di 14 anni") > -1 || name.indexOf("maggiore 14 anni") > -1 || name.indexOf("ADULTI DRIVE") > -1) eta = 14;
                if (name.indexOf("SCREENING SCUOLA") > -1 || name.indexOf("PERSONALE ISTITUTI SCOLASTICI") > -1) eta = 50;
            }

            //console.log(name, [cat, eta]);
            return {
                cat,
                eta
            };
        }

        function startParsing() {
            //console.log(agende);
            $("#warningText1").text("Raccolgo informazioni sulle agende. Ho trovato " + agende.length + " agende.");
            agende.forEach(function(agenda) {
                if (!agenda.num) return;

                getAppuntamenti(agenda.num, function(err, data) {
                    //console.log(agenda.num, data);
                    $("#warningText2").text("Appuntamenti per l'agenda " + agenda.num + " ricevuti.");
                    if (err) return console.log(err);
                    if (data) {
                        let parsed = parseData(data.descrizioneStruttura);
                        //console.log(parsed.eta);
                        results[parsed.eta].push({
                            eta: parsed.eta,
                            sede: parsed.cat[0],
                            tipo: parsed.cat[1],
                            agenda: data.agenda,
                            dataErogazione: data.dataErogazione,
                            nomeCompleto: data.descrizioneStruttura
                        });
                    }
                });
            });
        }

        function cleanAgende() {
            [{
                eta: 0,
                name: "TUTTE LE ETA"
            }, {
                eta: 6,
                name: "MAGGIORE 6 ANNI"
            }, {
                eta: 14,
                name: "MAGGIORE 14 ANNI"
            }, {
                eta: 99,
                name: "PEDIATRICI"
            }, {
                eta: 50,
                name: "SCUOLE"
            }, {
                eta: 100,
                name: "14-60 ANNI"
            }, {
                eta: 101,
                name: "14-60 ANNI"
            }].forEach(function(key) {
                //console.log(key);

                if ($("#" + key.eta + "-drive").children().length === 1) {
                    $("#" + key.eta + "-drive").remove();
                };
                if ($("#" + key.eta + "-tamponi").children().length === 1) {
                    $("#" + key.eta + "-tamponi").remove();
                };
                if ($("#" + key.eta + "-dsp").children().length === 1) {
                    $("#" + key.eta + "-dsp").remove();
                };
                if ($("#" + key.eta + "-blu").children().length === 1) {
                    $("#" + key.eta + "-blu").remove();
                };
                if ($("#" + key.eta).children().length === 2) {
                    $("#" + key.eta).parent().remove();
                };
            });
        }

        function anticache() {
            return "" + new Date().getTime() + "." + Math.random();
        }

        function getDate() {
            let a = new Date();
            let b = new Date();
            b.setDate(a.getDate() + 7);

            return {
                a: Math.round(a.getTime()),
                b: Math.round(b.getTime())
            }
        }



        $(document).ajaxStop(function() {
            //console.log("Tutte le agende completate");
            //console.log(results);
            $("#warningText3").text("Tutte le agende sono state valutate. Mostro i risultati.");
            removeWarning();
            addElements();
            Object.keys(results).forEach(function(key) {
                let result = results[key];
                result = result.sort((a, b) => (a.sede > b.sede) ? 1 : ((b.sede > a.sede) ? -1 : 0));
                result.forEach(function(entry) {
                    let parsedDataErogazione = new Intl.DateTimeFormat("it").format(new Date(entry.dataErogazione));
                    /*$("<p onclick=\"$('select[name=strutturaRicercaAppuntamento]').val(" + entry.agenda + ")\"><span style='color: blue; text-decoration: underline; cursor: pointer'> • " + entry.sede + ": " + parsedDataErogazione + "</span> (" + entry.nomeCompleto + ")</p>").appendTo("#" + entry.eta + "-" + entry.tipo.toLowerCase());*/
                    $("<p onclick=\"$('select[name=strutturaRicercaAppuntamento]').val(" + entry.agenda + "); document.getElementsByName('strutturaRicercaAppuntamento')[0].scrollIntoView({ behavior: 'smooth', block: 'center' });\"><span title=\"" + entry.nomeCompleto + "\" style='color: blue; text-decoration: underline; cursor: pointer'> • " + entry.sede + ": " + parsedDataErogazione + "</span></p>").appendTo("#" + entry.eta + "-" + entry.tipo.toLowerCase());
                });
            });

            cleanAgende();
        });

        $('<input class="button" type="button" id="startExtension" value="Prenotazione semplificata">').click(function() {
            startExtension();
        }).insertAfter($("[name=selezionaAppuntamentoButton]"));

        $("select[name=strutturaRicercaAppuntamento] option").each(function(a, b) {
            agende.push({
                num: $(b).val(),
                text: $(b).text()
            });
        });
    }



    function agendaTamponiMenu() {
        let isAuth = sessionStorage.getItem("isAuth") || false;
        let profiloUtente = $("#identita_id").val();

        function createiFrame() {
            $('<iframe src="/servizi/index.php"></iframe>').insertAfter("body").hide().on("load", function() {
                sessionStorage.setItem("isAuth", "true");
                createDivMenu();
            });
        }

        function createDivMenu() {
            let covidHtml = `
        		<li class="menu_expanded">
        			<a href="" class="menuToggle"><span>Gestione malattia (funziona solo su identità principale)</span></a>
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
        		</li>
        		<li class="menu_expanded">
        			<a href="" class="menuToggle"><span>Consulta agende (funziona solo su identità agenda)</span></a>
        			<ul class="">
        				<li class="">
        					<a href="https://ws.bolognaausl.progetto-sole.it/soleweb/login?wicket:bookmarkablePage=:it.cup2000.soleweb.covid19.page.PianoLavoroCalendarPage" title="Piano di Lavoro"><span>Piano di Lavoro</span></a>
        				</li>
        			</ul>
        		</li>`

                    $("#top_cvd19").html(covidHtml);
        }

        function createTempDivMenu() {
            let covidHtml = `
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
        		</div>`

            $(".box-sx.prf").after(covidHtml);
        }

        if (isAuth) {
            createTempDivMenu();
            createDivMenu();
        } else {
            createTempDivMenu();
            createiFrame();
        }
    }

    if (window.location.href.match(/^https\:\/\/www\.progetto-sole\.it\/riservata.*$/)) agendaTamponiMenu();
    if (window.location.href.match(/^https\:\/\/ws\.bolognaausl\.progetto-sole\.it\/soleweb\/\?wicket\:interface.*$/)) prenotazioneTamponi();

})();
