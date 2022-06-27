/*
	GW WaveForm Viewer
*/
(function(root){

	if(!root.ready){
		root.ready = function(fn){
			// Version 1.1
			if(document.readyState != 'loading') fn();
			else document.addEventListener('DOMContentLoaded', fn);
		};
	}
	function errorMessage(msg,error){
		console.error(msg,error);
		var el = document.getElementById('error-message');
		if(!el){
			el = document.createElement('div');
			el.style = 'background:#FFBABA;color:#D8000C;padding:0.5em;position:fixed;bottom:0;left:0;right:0;text-align:center;';
			document.body.appendChild(el);
		}
		el.innerHTML = '<span style="border-radius:100%;width:1em;height:1em;line-height:1em;margin-right:0.5em;display:inline-block;background:#D8000C;color:white;">&times;</span>'+msg;
	}

	function WaveFitter(opts){

		this.version = "2.1.0";
		console.info('WaveFitter '+this.version);
		this._opts = opts||{};
		this.getUrlVars();
		this.debug = (this.urlVars.debug) ? this.urlVars.debug : false;
		this.sliders = opts.sliders || null;
		var _obj = this;
		this.graph = new Graph(opts.graphholder,{'getText':function(txt){ return _obj.getTl(txt); }});
		this.scales = {};
		if(this.urlVars.simulation) opts.simulation = this.urlVars.simulation;
		if(this.urlVars.data) opts.data = this.urlVars.data;

		// Set properties
		this.props = {
			'mass':{
				'range':[20,100]
			},
			'dist':{
				'range':[100,800]
			},
			'inclination':{
				'range':[0,90],
				'values':[0,90],
				'options':{
					'start': [0,90],
					'connect':[false,true,false],
					'range': { 'min': 0, 'max': 90 },
					'tooltips':[{to:function(v){ return Math.round(v)+'&deg;'; }},{to:function(v){ return Math.round(v)+'&deg;'; }}],
					'step': 1,
					'pips': {mode: 'values', values: [0,90], density:100}
				}
			},
			'massratio': {
				'range': [0.1,1],
				'value': 1,
				'options':{
					'step': 0.1,
					'tooltips':[{to:function(v){ return v.toFixed(1); }}],
					'pips': {mode: 'values', values: [0.1,1], density:100,'format':{'to':function(v){ return v.toFixed(1); }}},
					'onupdate': function(e,test){
						this.loadSim(opts.simulation);
					}
				}
			}
		};
		this.props.mass.value = this.props.mass.range[0] + Math.random()*(this.props.mass.range[1]-this.props.mass.range[0]);
		this.props.dist.value = this.props.dist.range[0] + Math.random()*(this.props.dist.range[1]-this.props.dist.range[0]);

		this.addSliders();
		this.graph.update();

		if(this.urlVars.level!="advanced"){
			if(this.sliders.inclination) this.sliders.inclination.style.display = "none";
			if(this.sliders.massratio) this.sliders.massratio.style.display = "none";
		}

		// Attach the window event
		var _wf = this;
		window.addEventListener('resize', function(){ _wf.resize(); });
		// Attach more events
		document.getElementById('about-button').addEventListener('click',function(){ showAbout(); });
		document.getElementById('about-close').addEventListener('click',function(){ hideAbout(); });

		if(!this.wavedata && opts.data && opts.simulation) this.load(opts.data,opts.simulation);

		return this;
	}
	
	WaveFitter.prototype.resize = function(){
		this.graph.update();
		this.updateCurves();

		return this;
	};

	WaveFitter.prototype.load = function(filedata,filesim){		
		this.wavedata = {'dataH':null,'simNR':null};

		this.loadData(filedata);
		this.loadSim(filesim);

		return this;
	};

	WaveFitter.prototype.loadData = function(file){
		console.info('Loading data from '+file);
		fetch(file).then(response => {
			if(!response.ok) throw new Error('Network response was not OK');
			return response.text();
		}).then(txt => {
			console.info('Loaded dataH');
			this.wavedata.dataH = parseCSV(txt);
			this.updateData();
		}).catch(error => {
			errorMessage('Unable to load the data "'+file+'"',error);
		});
		return this;
	};

	WaveFitter.prototype.loadSim = function(file){
		file = file.replace(/\{MASSRATIO\}/,this.props.massratio.value.toFixed(1));
		console.info('Loading data from '+file);
		fetch(file).then(response => {
			if(!response.ok) throw new Error('Network response was not OK');
			return response.text();
		}).then(txt => {
			console.info('Loaded simNR');
			this.wavedata.simNR = parseCSV(txt);
			this.updateData();
		}).catch(error => {
			errorMessage('Unable to load the simulation "'+file+'"',error);
		});
		return this;
	};

	WaveFitter.prototype.setLanguage = function(lang){

		console.info('WaveFitter.setLangage',lang);
		this.lang = lang;
		this.langdict = lang.translations;

		return this;
	};

	WaveFitter.prototype.getUrlVars = function(){
		var vars = {},hash;
		var url = window.location.href;
		if(window.location.href.indexOf('?')!=-1){
			var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
			url = window.location.href.slice(0,window.location.href.indexOf('?'));
			for(var i = 0; i < hashes.length; i++){
				hash = hashes[i].split('=');
				vars[hash[0]] = hash[1];
			}
		}
		this.urlVars = vars;
		this.url = url;
	};

	WaveFitter.prototype.makeUrl = function(newKeys,full){
		var newUrlVars = this.urlVars;
		var allKeys = {"lang":[this.lang.lang]};
		var key,newUrl;
		for(key in allKeys){
			if(this.debug){console.log(key,allKeys[key]);}
			if((allKeys[key][0]!=allKeys[key][1])) newUrlVars[key]=allKeys[key][0];
			else delete newUrlVars[(key)];
		}
		if(this.debug){console.log('new urlvars',newUrlVars);}
		for(key in newKeys){
			if(!newKeys[key]) delete newUrlVars[key];
			else newUrlVars[key]=newKeys[key];
		}
		newUrl = this.url+'?';
		for(key in newUrlVars) newUrl=newUrl + key+'='+newUrlVars[key]+'&';
		newUrl = newUrl.slice(0,newUrl.length-1);
		return newUrl;
	};

	WaveFitter.prototype.getTl = function(code){
		var _wf = this;
		if(_wf.lang){
			var lang = _wf.lang.lang;
			var o = clone(_wf.langdict);
			// Step through the bits of our code e.g. text.about.heading
			var bits = code.split(/\./);
			for(var i = 0; i < bits.length; i++) o = o[bits[i]];
			return o[lang]||"";
		}else{
			return "";
		}
	};

	WaveFitter.prototype.updateData = function(){

		// Set the data series
		if(this.wavedata.dataH!==null && !this.graph.series[0]){
			this.graph.setSeries(0,this.wavedata.dataH,{'id':'line-data','text':'text.legend.data','class':'data','stroke':'rgba(0,150,200,1)'});
			// Update the ranges
			this.graph.axes.x.setRange(this.graph.series[0]);
		}
		if(this.wavedata.simNR!==null){
			this.graph.setSeries(1,this.wavedata.simNR,{
				'id':'line-sim',
				'text':'text.legend.simulation',
				'class':'sim',
				'range':true,
				'stroke':'rgba(200,150,0,1)',
				'fill':'rgba(200,150,0,1)',
				'scale': function(t,m,d){
					var tScale = (t-this.t0)*this.M0/m + this.t0;
					return this.getH(tScale)*(m/this.M0)*(this.D0/d);
				},
				'scaleLine': function(m,d,tout){
					if(typeof m==="string") m = parseFloat(m);
					if(typeof m==="string") d = parseFloat(d);
					this.mass=m;
					this.dist=d;
					if(!tout) tout = this.t;
					// Create a new lineData array using the times provided
					this.lineData = [];
					for(var i = 0 ; i < tout.length ; i++) this.lineData[i] = {'t':tout[i],'h':this.scale(tout[i],m,d)};
					return;
				}
			});
		}

		this.graph.axes.y.setRange(-2,2);

		// Update the scales and domains
		this.graph.updateData();

		// Draw the data
		this.graph.drawData();
		this.updateCurves();

		this.graph.update();

		return this;
	};

	WaveFitter.prototype.updateCurves = function(dur=0){

		if(!this.graph.series[0]){
			console.warn('No data loaded yet');
			return this;
		}

		if(this.graph.series[1]){
			var thetamax,thetamin,inc;
			inc = this.props.inclination.slider.noUiSlider.get();
			inc[0] = parseFloat(inc[0]);
			inc[1] = parseFloat(inc[1]);
			thetamin = inc[1]*Math.PI/180;
			thetamax = inc[0]*Math.PI/180;

			this.graph.series[1].data[0].scaleLine(this.props.mass.value,this.props.dist.value*(0.5*(1 + Math.pow(Math.cos(thetamin),2))),this.graph.series[0].data[0].t);
			this.graph.series[1].data[1].scaleLine(this.props.mass.value,this.props.dist.value*(0.5*(1 + Math.pow(Math.cos(thetamax),2))),this.graph.series[0].data[0].t);
			this.graph.drawData();
		}
		return this;
	};

	WaveFitter.prototype.setSliderValue = function(t,v){
		if(this.props[t] && this.props[t].slider){
			this.props.mass.value = v;
			this.props[t].slider.noUiSlider.set(v);
		}else{
			console.warn('No slider for '+t+' to set value for.');
		}
		return this;
	};

	WaveFitter.prototype.setSliderRange = function(t,min,max){
		if(this.props[t] && this.props[t].slider){
			this.props[t].slider.noUiSlider.updateOptions({ range:{ 'min': min,'max': max } });
		}else{
			console.warn('No slider for '+t+' to update range for.');
		}
		return this;
	};
	
	WaveFitter.prototype.addSlider = function(s){
		var _wf=this;
		var options;
		if(this.sliders[s]){
			this.props[s].el = this.sliders[s].querySelector('.param-slider-outer');
			if(!this.props[s].el.querySelector('.param-slider')){
				this.props[s].slider = document.createElement('div');
				this.props[s].slider.classList.add('param-slider');
				this.props[s].slider.setAttribute('id',s+'-slider');
				this.props[s].el.appendChild(this.props[s].slider);

				options = this.props[s].options || {};
				if(!options.start) options.start = this.props[s].value;
				if(!options.connect) options.connect = true;
				if(!options.range) options.range = { 'min': this.props[s].range[0], 'max': this.props[s].range[1] };
				if(!options.tooltips) options.tooltips = [true];
				if(!options.pips) options.pips = {mode: 'positions', values: [0,100], density:100};
				noUiSlider.create(this.props[s].slider, options);
				this.props[s].slider.noUiSlider.on('update',function(values,handle){
					var value = parseFloat(values[handle]);
					_wf.props[s].value = value;
					if(_wf.props[s].options && typeof _wf.props[s].options.onupdate==="function") _wf.props[s].options.onupdate.call(_wf,s,this);
					else _wf.updateCurves(0);
				});
				this.props[s].slider.querySelector('.noUi-value').addEventListener('click',function(e){
					_wf.props[s].slider.noUiSlider.set(Number(this.getAttribute('data-value')));
				});
			}
		}
		return this;
	};

	WaveFitter.prototype.addSliders = function(){
		
		for(var s in this.props) this.addSlider(s);

		return this;
	};

	function parseCSV(str) {
		var lines = str.split(/\n/g);
		var rows = [];
		var r,i,c;
		for(i = 1; i < lines.length; i++){
			if(lines[i] != ""){
				rows.push(lines[i].split(/,/g));
				r = rows.length-1;
				for(c = 0; c < rows[r].length; c++) rows[r][c] = parseFloat(rows[r][c]);
			}
		}
		return rows;
	}

	function showAbout(){
		var el = document.getElementById('about');
		el.classList.add('on');
		document.body.classList.add('with-overlay');
	}
	function hideAbout(){
		var el = document.getElementById('about');
		el.classList.remove('on');
		document.body.classList.remove('with-overlay');
	}

	function clone(el){
		if(typeof el==="undefined") return {};
		return JSON.parse(JSON.stringify(el));
	}

	root.WaveFitter = WaveFitter;

})(window || this);
