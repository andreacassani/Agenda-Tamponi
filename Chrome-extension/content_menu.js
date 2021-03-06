const profiloUtente = $("#identita_id").val();

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
