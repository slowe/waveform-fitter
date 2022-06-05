/*
	GW WaveForm Editor v2.0.2
*/
(function(root){

	if(!root.ready){
		root.ready = function(fn){
			// Version 1.1
			if(document.readyState != 'loading') fn();
			else document.addEventListener('DOMContentLoaded', fn);
		};
	}
	function Range(min,max){
		this.min = min;
		this.max = max;
		this.range = max-min;
		this.frac = function(t){ return (t-this.min)/this.range; };
		this.valueFromFrac = function(f){ return this.min + f*this.range; };
		this.domain = function(mn,mx){ this._domain = new Range(mn,mx); return this; };
		this.value = function(v){ return (this._domain||this).valueFromFrac(this.frac(v)); };
		return this;
	}
	class WaveData{
		constructor(datain){
			if(Array.isArray(datain)){
				if((datain.length>0) && (datain[0].length>=2)){
					this.t=datain.map(function(value,index){return value[0];});
					this.h=datain.map(function(value,index){return value[1];});
				}else{
					console.error("datain needs to be 2D array with dimension Nx2 for N datapoints",datain);
					return(null);
				}
			}else{
				if(datain.hasOwnProperty('t')&datain.hasOwnProperty('t')){
					this.t = datain.t;
					this.h = datain.h;
				}else{
					console.error("datain needs to be 2D array or object with data in properties t and h");
					return(null);
				}
			}
			this.linedata();
		}
		linedata(){
			this.lineData = [];
			for(var i = 0 ; i < this.t.length ; i++) this.lineData.push({'t':this.t[i],'h':this.h[i]});
			// Set the range of the data
			this.data = new Range(this.t[0], this.t[this.t.length-1]);
			this.data.domain(0,this.t.length);
			// Set the range of the indices
		}
		getH(t){
			var h0,i,i0,i1,di;
			if(Array.isArray(t)){
				h0 = [];
				for(i = 0 ; i < t.length ; i++) h0.push(this.getH(t[i]));
			}else{
				var idx = this.data.value(t);
				if(idx < 0){
					h0 = NaN;
				}else if(idx > this.t.length-1){
					h0 = 0;
				}else{
					i0 = Math.floor(idx), i1 = Math.ceil(idx), di = idx%1;
					h0 = (1-di)*this.h[i0] + di*this.h[i1];
				}
			}
			return h0;
		}
		shiftt(t0){
			for(var i = 0 ; i < this.t.length; i++) this.t[i] += t0;
			this.linedata();
		}
	}

	class ScaleableWaveData extends WaveData{
		constructor(datain,mass=65,dist=420){
			super(datain);
			this.t0 = 0.423;
			this.M0 = 65;
			this.D0 = 420;
			this.mass = (mass) ? mass : 65;
			this.dist = (dist) ? dist : 420;
			this.scale(mass,dist);
		}
		scale(m,d,tout){
			if(typeof m==="string") m = parseFloat(m);
			if(typeof m==="string") d = parseFloat(d);
			this.mass=m;
			this.dist=d;
			if (!tout){
				tout=this.t;
			}
			var dout=[];
			var tScale,hout,i;
			for(i = 0 ; i < tout.length ; i++){
				tScale=(tout[i]-this.t0)*this.M0/m + this.t0;
				hout=this.getH(tScale)*(m/this.M0)*(this.D0/d);
				if(!Number.isNaN(hout)) dout.push([tout[i],hout]);
			}
			if(dout.length == 0){
				console.warn('ScaleableWaveData has no height in the graph range.');
				for(i = 0 ; i < tout.length ; i++) dout.push([tout[i],0]);
			}
			return(new WaveData(dout));
		}
	}

	function errorMessage(msg,error){
		console.error(msg,error);
		el = document.getElementById('error-message');
		if(!el){
			el = document.createElement('div');
			el.style = 'background:#FFBABA;color:#D8000C;padding:0.5em;position:fixed;bottom:0;left:0;right:0;text-align:center;';
			document.body.appendChild(el);
		}
		el.innerHTML = '<span style="border-radius:100%;width:1em;height:1em;line-height:1em;margin-right:0.5em;display:inline-block;background:#D8000C;color:white;">&times;</span>'+msg;
	}

	function defaultSpacing(mn,mx,n){

		var dv,log10_dv,base,frac,options,distance,imin,tmin,i;

		// Start off by finding the exact spacing
		dv = (mx-mn)/n;

		// In any given order of magnitude interval, we allow the spacing to be
		// 1, 2, 5, or 10 (since all divide 10 evenly). We start off by finding the
		// log of the spacing value, then splitting this into the integer and
		// fractional part (note that for negative values, we consider the base to
		// be the next value 'down' where down is more negative, so -3.6 would be
		// split into -4 and 0.4).
		log10_dv = Math.log10(dv);
		base = Math.floor(log10_dv);
		frac = log10_dv - base;

		// We now want to check whether frac falls closest to 1, 2, 5, or 10 (in log
		// space). There are more efficient ways of doing this but this is just for clarity.
		options = [1,2,5,10];
		distance = new Array(options.length);
		imin = -1;
		tmin = 1e100;
		for(i = 0; i < options.length; i++){
			distance[i] = Math.abs(frac - Math.log10(options[i]));
			if(distance[i] < tmin){
				tmin = distance[i];
				imin = i;
			}
		}

		// Now determine the actual spacing
		return Math.pow(10,base)*options[imin];
	}

	function WaveFitter(opts){

		console.info('WaveFitter');
		this._opts = opts||{};
		this.getUrlVars();
		this.debug = (this.urlVars.debug) ? this.urlVars.debug : false;
		this.sliders = opts.sliders || null;
		this.graphel = opts.graphholder || null;
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
		this.updateGraph();

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
		this.updateGraph();
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
	}

	WaveFitter.prototype.loadSim = function(file){
		file = file.replace(/\{MASSRATIO\}/,this.props.massratio.value.toFixed(1))
		console.info('Loading data from '+file);
		fetch(file).then(response => {
			if(!response.ok) throw new Error('Network response was not OK');
			return response.text();
		}).then(txt => {
			console.info('Loaded simNR');
			this.wavedata.simNR = parseCSV(txt);
			this.updateData();
		}).catch(error => {
			errorMessage('Unable to load the simulation "'+filesim+'"',error);
		});
		return this;
	}


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

		if(this.wavedata.dataH && this.wavedata.simNR){

			this.data = {dataH: new WaveData(this.wavedata.dataH), simNR: new ScaleableWaveData(this.wavedata.simNR), simThetaMax: new ScaleableWaveData(this.wavedata.simNR), simThetaMin: new ScaleableWaveData(this.wavedata.simNR) };

			this.data.trange = [this.data.dataH.t[0], this.data.dataH.t[this.data.dataH.t.length-1]];
			this.data.hrange = [-2,2];

			if(this.axes.x) this.axes.x.setScale((new Range(this.data.trange[0],this.data.trange[1])).domain(0, this.scales.graphWidth));
			if(this.axes.y) this.axes.y.setScale((new Range(this.data.hrange[0],this.data.hrange[1])).domain(this.scales.graphHeight, 0));

			this.drawData();
		}

		return this;
	};

	WaveFitter.prototype.updateGraph = function(){
		
		var holder = this.graphel;
		var tempsvg = null;

		if(this.svg && this.svg.el){
			// Remove the element so we can work out the size of the container
			tempsvg = holder.removeChild(this.svg.el);
		}

		this.scales.svgWidth = Math.floor(holder.offsetWidth);
		this.scales.svgHeight = holder.offsetHeight||Math.floor(this.scales.svgWidth/2);
		this.scales.svgMargin = {'left':75,'right':18,'top':10,'bottom':60};
		this.scales.graphWidth = this.scales.svgWidth-this.scales.svgMargin.left-this.scales.svgMargin.right;
		this.scales.graphHeight = this.scales.svgHeight-this.scales.svgMargin.top-this.scales.svgMargin.bottom;

		if(tempsvg) holder.appendChild(tempsvg);

		if(!this.svg){

			this.svg = {};
			this.svg.el = holder.querySelector('svg');
			this.svg.el.classList.add('graph');
		}
		
		this.svg.el.setAttribute('width',(this.scales.svgWidth));
		this.svg.el.setAttribute('height',(this.scales.svgHeight));
		
		if(!this.svg.defs){
			this.svg.defs = svgEl('defs').appendTo(this.svg.el);
		}

		if(!this.svg.clip){
			this.svg.clip = svgEl('clipPath');
			this.svg.clip.appendTo(this.svg.defs).attr('id','clip');
			this.svg.cliprect = svgEl('rect').appendTo(this.svg.clip).attr({'x':0,'y':0});
		}

		this.svg.cliprect.attr({'width':this.scales.graphWidth,'height':this.scales.graphHeight});


		// Create axes
		if(!this.axes) this.axes = {};
		var xprops = {
			'key': 't',
			'dir': 'bottom',
			'ticks': {'spacing':0.02,'length':-this.scales.graphHeight},
			'width': this.scales.graphWidth,
			'height': this.scales.graphHeight
		};
		if(!this.svg.xaxis){
			// Make x-axis
			this.svg.xaxis = svgEl('g').appendTo(this.svg.el).addClass("x-axis axis").attr({'id':'x-axis-g'});
			this.axes.x = new Axis(this.svg.xaxis,xprops,svgEl('text').addClass("x-axis axis-label translate").attr({'dominant-baseline':'hanging','text-anchor':'middle','data-translate':'site.translations[text.axis.time][site.lang]'}).html(this.getTl('text.axis.time')));
		}else{
			this.axes.x.setDomain(0,this.scales.graphWidth).setProps(xprops).updateSize();
		}
		this.svg.xaxis.attr({'transform': "translate("+this.scales.svgMargin.left+"," + (this.scales.graphHeight + this.scales.svgMargin.top) + ")"});
		if(this.axes.x.label) this.axes.x.label.attr({'x':this.scales.graphWidth/2,'y':(this.scales.svgMargin.bottom-(this.scales.svgMargin.left/4)-5)+"px","font-size":(this.scales.svgMargin.left/4)+"px"});
		var yprops = {
			'key': 'h',
			'dir': 'left',
			'ticks': {'spacing':0.5,'length':-this.scales.graphWidth},
			'width': this.scales.graphWidth,
			'height': this.scales.graphHeight
		};
		if(!this.svg.yaxis){
			// Make y-axis
			this.svg.yaxis = svgEl('g').appendTo(this.svg.el).addClass("y-axis axis").attr({'id':'y-axis-g'});
			this.axes.y = new Axis(this.svg.yaxis,yprops,svgEl('text').addClass("y-axis axis-label translate").attr({'dominant-baseline':'hanging','transform':'rotate(-90)','text-anchor':'middle','data-translate':'site.translations[text.axis.strain][site.lang]'}).html(this.getTl('text.axis.strain')));
		}else{
			this.axes.y.setDomain(this.scales.graphHeight,0).setProps(yprops).updateSize();
		}
		this.svg.yaxis.attr({'transform': "translate("+this.scales.svgMargin.left+"," + this.scales.svgMargin.top + ")"});
		if(this.axes.y.label) this.axes.y.label.attr({'x':-this.scales.graphHeight/2,'y':(-this.scales.svgMargin.left*0.95 + 5)+'px',"font-size":(this.scales.svgMargin.left/4)+"px"});



		// Make data
		if(!this.svg.data){
			this.svg.data = svgEl("g").appendTo(this.svg.el).attr({"id":"data-g",'clip-path':'url(#clip)'});
		}
		this.svg.data.attr({"transform":"translate("+this.scales.svgMargin.left+","+(this.scales.svgMargin.top) + ")"});
		this.drawData();

		// Make legend
		if(!this.svg.legend){
			this.svg.legend = svgEl('g').appendTo(this.svg.el).addClass('legend');
			this.svg.items = {};
			this.svg.items.dataline = svgEl('line').appendTo(this.svg.legend).addClass('line data').attr({'x1':0,'x2':(50).toFixed(1),'y1':0,'y2':0});
			this.svg.items.datatext = svgEl('text').appendTo(this.svg.legend).addClass('leg-text data translate').attr({'x':(50 + 10).toFixed(1),'y':0,'data-translate':'site.translations[text.legend.data][site.lang]'}).html(this.getTl('text.legend.data'));
			this.svg.items.simline = svgEl('line').appendTo(this.svg.legend).addClass('line sim').attr({'x1':0,'x2':(50).toFixed(1),'y1':30,'y2':30});
			this.svg.items.simtext = svgEl('text').appendTo(this.svg.legend).addClass('leg-text sim translate').attr({'x':(50 + 10).toFixed(1),'y':30,'data-translate':'site.translations[text.legend.simulation][site.lang]'}).html(this.getTl('text.legend.simulation'));
		}
		// Update legend position
		this.svg.legend.attr('transform',"translate("+(this.scales.svgMargin.left+10)+"," + (this.scales.svgMargin.top+20) + ")");


		return this;
	};

	WaveFitter.prototype.drawData = function(){

		if(typeof this.line==="undefined") this.line = svgEl('path').appendTo(this.svg.data).addClass('line data').attr({'id':'line-data','stroke-width':2,'fill':'none'});
		if(this.data && this.data.dataH) this.line.attr({'d':makePath(this.data.dataH.lineData,this.axes)});

		if(typeof this.sim==="undefined") this.sim = svgEl('path').appendTo(this.svg.data).addClass('line sim').attr({'id':'line-data','stroke-width':2,'fill':'none'});

		if(this.data && this.axes.x) this.axes.x.setTickSpacing(defaultSpacing(this.data.trange[0],this.data.trange[1],8));

		return this.updateCurves();
	};

	WaveFitter.prototype.updateCurves = function(dur=0){
		if(!this.data){
			console.warn('No data loaded yet');
			return this;
		}

		if(this.sim){
			var d,thetamax,thetamin,inc;
			inc = this.props.inclination.slider.noUiSlider.get();
			inc[0] = parseFloat(inc[0]);
			inc[1] = parseFloat(inc[1]);
			thetamin = inc[1]*Math.PI/180;
			thetamax = inc[0]*Math.PI/180;

			this.data.plotThetaMax = this.data.simThetaMax.scale(this.props.mass.value,this.props.dist.value*(0.5*(1 + Math.pow(Math.cos(thetamin),2))),this.data.dataH.t);
			this.data.plotThetaMin = this.data.simThetaMin.scale(this.props.mass.value,this.props.dist.value*(0.5*(1 + Math.pow(Math.cos(thetamax),2))),this.data.dataH.t);

			d = makePath(this.data.plotThetaMax.lineData,this.axes);
			d += 'L'+makePath(this.data.plotThetaMin.lineData,this.axes,true).substr(1);
			this.sim.attr('d',d);
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

	function Axis(el,props,label){

		var tick,translate,attrline,attrtext;
		el.attr({'fill':'none','font-size':'10','font-family':'sans-serif','text-anchor':(props.dir=="left") ? 'end' : 'middle'});
		
		this.key = props.key||"";

		var dp = 0;

		this.path = svgEl('path').appendTo(el).addClass('domain').attr({'stroke':'#000'});

		if(label){
			this.label = label;
			this.label.appendTo(el);
		}
		this.updateDP = function(){
			dp = 0;
			if(typeof props.ticks.spacing==="number"){
				var str = ((props.ticks.spacing||"")+"");
				// Count decimal places
				if(str.match(".")) dp = str.split(".")[1].length;
			}
			return this;
		}
		this.setTickSpacing = function(s){
			props.ticks.spacing = s;
			return this.updateDP().updateTicks()
		}
		this.setProps = function(p){
			if(typeof p==="object") props = p;
			else props = {};
			this.key = props.key||"";
			return this.updateDP();
			return this;
		};
		this.setScale = function(s){
			this.scale = s;
			return this.updateTicks();
		};
		this.setDomain = function(a,b){
			this.scale.domain(a,b);
			return this;
		};
		this.updateTicks = function(){
			var t,v,p2,ticks,attr;
			ticks = el._el.querySelectorAll('.tick');
			for(t = 0; t < ticks.length; t++) ticks[t].parentNode.removeChild(ticks[t]);
			for(v = this.scale.min ; v <= this.scale.max; v += props.ticks.spacing){
				attr = {'opacity':1};
				attrline = {'stroke':'#000'};
				attrtext = {'fill':'#000'};
				translate = "";
				p2 = "";
				if(props.dir=="left"){
					attr.transform = 'translate(0,'+this.scale.value(v).toFixed(1)+')';
					attrline.x2 = -props.ticks.length;
					attrtext.x = -6;
					attrtext.dy = "0.32em";
				}else if(props.dir=="bottom"){
					attr.transform = 'translate('+this.scale.value(v).toFixed(1)+',0)';
					attrline.y2 = props.ticks.length;
					attrtext.y = 8;
					attrtext.dy = "0.71em";
				}
				tick = svgEl('g').appendTo(el).addClass('tick').attr(attr);
				svgEl('line').appendTo(tick).attr(attrline);
				svgEl('text').appendTo(tick).attr(attrtext).html(v.toFixed(dp));
			}
			return this;
		};
		this.updateSize = function(w,h){
			if(!w) w = props.width;
			if(!h) h = props.height;
			this.path.attr({'d':(props.dir=="left") ? 'M'+w+','+h+'H0.5V0.5H'+w : 'M0.5,-'+h+'V0.5H'+w+'.5V-'+h});
			if(this.scale) this.updateTicks();
			return this;
		};

		this.setProps(props).updateSize();
		
		return this;
	}

	function makePath(data,axes,reverse){
		var d = '';
		var i;
		if(axes.x.scale && axes.y.scale){
			if(reverse){
				for(i = data.length-1; i >= 0; i--) d += (i==0 ? 'M':'L')+axes.x.scale.value(data[i][axes.x.key]).toFixed(2)+','+axes.y.scale.value(data[i][axes.y.key]).toFixed(2);			
			}else{
				for(i = 0; i < data.length; i++) d += (i==0 ? 'M':'L')+axes.x.scale.value(data[i][axes.x.key]).toFixed(2)+','+axes.y.scale.value(data[i][axes.y.key]).toFixed(2);
			}
		}
		return d;
	}

	function svgElement(t){
		this._el = document.createElementNS('http://www.w3.org/2000/svg',t);
		this.append = function(el){ this._el.appendChild(el); return this; };
		this.appendTo = function(el){ if(el._el){ el._el.appendChild(this._el); }else{ el.appendChild(this._el); } return this; };
		this.attr = function(obj,v){
			var key;
			// Build an object from a key/value pair
			if(typeof obj==="string"){ key = obj; obj = {}; obj[key] = v; }
			for(key in obj) this._el.setAttribute(key,obj[key]);
			return this;
		};
		this.html = function(t){ this._el.textContent = t; return this; };
		this.addClass = function(cls){ this._el.classList.add(...cls.split(" ")); return this; };
		this.removeClass = function(){ this._el.classList.remove(...arguments); return this; };
		this.data = function(d){ this._data = d; return this; };
		return this;
	}

	function svgEl(t){ return new svgElement(t); }

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
