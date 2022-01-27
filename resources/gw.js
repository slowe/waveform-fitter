/*
	GW WaveForm Editor v2
*/
(function(root){

	var GW = root.GW || {};
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
		this.valueFromFrac = function(f){ return this.min + f*this.range; }
		this.domain = function(mn,mx){ this._domain = new Range(mn,mx); return this; };
		this.value = function(v){ return (this._domain||this).valueFromFrac(this.frac(v)); }
		return this;
	}
	class WaveData{
		constructor(datain){
			if(Array.isArray(datain)){
				if((datain.length>0)&(datain[0].length>=2)){
					this.t=datain.map(function(value,index){return value[0]})
					this.h=datain.map(function(value,index){return value[1]})
				}else{
					console.log("datain needs to be 2D array with dimension Nx2 for N datapoints",datain.length,datain[0].length)
					return(null);
				}
			}else{
				if(datain.hasOwnProperty('t')&datain.hasOwnProperty('t')){
					this.t = datain.t;
					this.h = datain.h
				}else{
					console.log("datain needs to be 2D array or object with data in properties t and h")
					return(null);
				}
			}
			this.linedata();
		}
		linedata(){
			this.lineData = [];
			for(var i = 0 ; i < this.t.length ; i++) this.lineData.push({'t':this.t[i],'h':this.h[i]})
			// Set the range of the data
			this.data = new Range(this.t[0], this.t[this.t.length-1]);
			this.data.domain(0,this.t.length);
			// Set the range of the indices
		}
		getH(t){
			var h0,i;
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
					let i0 = Math.floor(idx), i1 = Math.ceil(idx), di = idx%1;
					h0 = (1-di)*this.h[i0] + di*this.h[i1];
				};
			}
			return h0;
		}
		shiftt(t0){
			for(let i = 0 ; i < this.t.length; i++) this.t[i] += t0;
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
			this.mass=m;
			this.dist=d;
			if (!tout){
				tout=this.t;
			}
			var dout=[];
			for(var i=0;i<tout.length;i++){
				let tScale=(tout[i]-this.t0)*this.M0/m + this.t0;
				let hout=this.getH(tScale)*(m/this.M0)*(this.D0/d);
				if (!Number.isNaN(hout)){dout.push([tout[i],hout]);}
			}
			return(new WaveData(dout));
		}
	}

	function WaveFitter(opts){

		var _wf = this;
		console.info('WaveFitter');
		this.getUrlVars();
		this.debug = (this.urlVars.debug) ? this.urlVars.debug : false;
		this.holders = {'param':'','graph':''};
		this.init = function(opts){
			this._opts = opts||{};
			this.holders={
				'param':(opts.paramholder ? opts.paramholder : 'param-holder'),
				'mass':(opts.mass),
				'dist':(opts.dist),
				'graph':(opts.graphholder ? opts.graphholder : 'graph-holder')
			}
			this.lang = opts.lang;
			this.langdict = opts.lang.translations;

			if(!this.wavedata){
				console.info('Loading data from '+opts.data);
				fetch(opts.data).then(response => {
					if(!response.ok) throw new Error('Network response was not OK');
					return response.json();
				}).then(json => {
					_wf.wavedata = json;
					_wf.initData();
					_wf.addSliders();
					_wf.initGraph();
				}).catch(error => {
					console.error('There has been a problem with your fetch operation:', error);
				});
			}

			// Re-attach the window event
			window.addEventListener('resize', this.resize );

			return this;
		};


		return this;
	}
	
	WaveFitter.prototype.resize = function(){
		console.info('resize');
		return this;
	}

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
	}

	WaveFitter.prototype.makeUrl= function(newKeys,full){
		newUrlVars = this.urlVars;
		allKeys = {"lang":[this.lang.lang]}
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
	}
	WaveFitter.prototype.getTl = function(code){
		var _wf = this;
		var lang = _wf.lang.lang;
		var o = clone(_wf.langdict);
		// Step through the bits of our code e.g. text.about.heading
		var bits = code.split(/\./);
		for(var i = 0; i < bits.length; i++) o = o[bits[i]];
		return o[lang]||"";
	}
	WaveFitter.prototype.initData = function(){
		this.data = {dataH: new WaveData(this.wavedata.dataH), simNR: new ScaleableWaveData(this.wavedata.simNR)};
		this.ranges = {mass: [20,100], dist:[100,800]}
		this.mass = this.ranges.mass[0] + Math.random()*(this.ranges.mass[1]-this.ranges.mass[0]);
		this.dist = this.ranges.dist[0] + Math.random()*(this.ranges.dist[1]-this.ranges.dist[0]);
		this.data.trange = [this.data.dataH.t[0], this.data.dataH.t[this.data.dataH.t.length-1]];
		this.data.hrange = [-2,2];
		return this;
	}

	WaveFitter.prototype.setScales = function(){
		this.scales = {}
		this.scales.svgWidth = Math.floor(document.getElementById(this.holders.graph).offsetWidth);
		this.scales.svgHeight = document.getElementById(this.holders.graph).offsetHeight||Math.floor(this.scales.svgWidth/2);
		this.scales.svgMargin = {'left':80,'right':10,'top':10,'bottom':80}
		this.scales.graphWidth = this.scales.svgWidth-this.scales.svgMargin.left-this.scales.svgMargin.right;
		this.scales.graphHeight = this.scales.svgHeight-this.scales.svgMargin.top-this.scales.svgMargin.bottom;
		
		// set axis scales
		this.scales.x = {
			'key': 't',
			'dir': 'bottom',
			'ticks': {'spacing':0.02,'length':-this.scales.graphHeight},
			'scale':(new Range(this.data.trange[0],this.data.trange[1])).domain(0, this.scales.graphWidth),
			'width': this.scales.graphWidth,
			'height': this.scales.graphHeight
		};
		this.scales.y = {
			'key': 'h',
			'dir': 'left',
			'ticks': {'spacing':0.5,'length':-this.scales.graphWidth},
			'scale':(new Range(this.data.hrange[0],this.data.hrange[1])).domain(this.scales.graphHeight, 0),
			'width': this.scales.graphWidth,
			'height': this.scales.graphHeight
		};
		return this;
	}


	function makeAxis(el,props){
		var tick,v,translate,attrline,attrtext,attr,d;
		attr = {'fill':'none','font-size':'10','font-family':'sans-serif'};

		if(props.dir=="left"){
			attr['text-anchor'] = 'end';
			d = 'M'+props.width+','+props.height+'H0.5V0.5H'+props.width;
		}else if(props.dir=="bottom"){
			attr['text-anchor'] = 'middle';
			d = 'M0.5,-'+props.height+'V0.5H'+props.width+'.5V-'+props.height;
		}
		
		el.attr(attr);
		
		// Count decimal places
		var str = (props.ticks.spacing+"");
		var dp = 0;
		if(str.match(".")) dp = str.split(".")[1].length;

		svgEl('path').appendTo(el).addClass('domain').attr({'stroke':'#000','d':d});

		for(v = props.scale.min ; v <= props.scale.max; v += props.ticks.spacing){
			attr = {'opacity':1};
			attrline = {'stroke':'#000'};
			attrtext = {'fill':'#000'};
			translate = "";
			p2 = "";
			if(props.dir=="left"){
				attr['transform'] = 'translate(0,'+props.scale.value(v).toFixed(1)+')';
				attrline["x2"] = -props.ticks.length;
				attrtext["x"] = -3;
				attrtext["dy"] = "0.32em";
			}
			if(props.dir=="bottom"){
				attr['transform'] = 'translate('+props.scale.value(v).toFixed(1)+',0)';
				attrline["y2"] = props.ticks.length;
				attrtext["y"] = 3;
				attrtext["dy"] = "0.71em";
			}
			tick = svgEl('g').appendTo(el).addClass('tick').attr(attr);
			svgEl('line').appendTo(tick).attr(attrline);
			svgEl('text').appendTo(tick).attr(attrtext).html(v.toFixed(dp));//.replace(/(\.[0-9]*)0$/g,function(m,p1){ return p1; }).replace(/\.$/,""));
		}
		return el;
	}

	WaveFitter.prototype.initGraph = function(){

		this.setScales();

		document.getElementById('about-button').addEventListener('click',function(){ showAbout(); });
		document.getElementById('about-close').addEventListener('click',function(){ hideAbout(); });
		document.getElementById(this.holders.graph).style.height = '';

		var hid,defs,cp,rect;

		hid = document.getElementById(this.holders.graph);
		this.svg = hid.querySelector('svg');
		hid.appendChild(this.svg);
		this.svg.classList.add('graph');
		this.svg.setAttribute('width',(this.scales.svgWidth));
		this.svg.setAttribute('height',(this.scales.svgHeight));
		defs = svgEl('defs').appendTo(this.svg);
		
		cp = svgEl('clipPath');
		cp.appendTo(defs).attr('id','clip');
		svgEl('rect').appendTo(cp).attr({'x':0,'y':0,'width':this.scales.graphWidth,'height':this.scales.graphHeight});

		// Make x-axis
		xaxis = svgEl('g').appendTo(this.svg).addClass("x-axis axis").attr({'id':'x-axis-g','transform': "translate("+this.scales.svgMargin.left+"," + (this.scales.graphHeight + this.scales.svgMargin.top) + ")"});
		makeAxis(xaxis,this.scales.x);
		svgEl('text').appendTo(xaxis).addClass("x-axis axis-label translate").attr({'x':this.scales.graphWidth/2,'y':(this.scales.svgMargin.bottom/2)+"px",'text-anchor':'middle','data-translate':'site.data.translations[text.axis.time][post.lang]'}).html(this.getTl('text.axis.time'));

		// Make y-axis
		yaxis = svgEl('g').appendTo(this.svg).addClass("y-axis axis").attr({'id':'y-axis-g','transform': "translate("+this.scales.svgMargin.left+"," + this.scales.svgMargin.top + ")"});
		makeAxis(yaxis,this.scales.y);
		svgEl('text').appendTo(yaxis).addClass("y-axis axis-label translate").attr({'x':-this.scales.graphHeight/2,'y':6,'transform':'rotate(-90)','text-anchor':'middle','dy':(-this.scales.svgMargin.left/2)+"px","font-size":(this.scales.svgMargin.left/4)+"px",'data-translate':'site.data.translations[text.axis.strain][post.lang]'}).html(this.getTl('text.axis.strain'));

		// Add data group
		data = svgEl("g").appendTo(this.svg).attr({"id":"data-g","transform":"translate("+this.scales.svgMargin.left+","+(this.scales.svgMargin.top) + ")",'clip-path':'url(#clip)'});

		this.drawData();
		this.addLegend();
	}
	
	function makePath(data,props){
		//console.log('makePath',data,props);
		var d = '';
		for(var i = 0; i < data.length; i++){
			d += (i==0 ? 'M':'L')+props.x.scale.value(data[i][props.x.key]).toFixed(2)+','+props.y.scale.value(data[i][props.y.key]).toFixed(2);
		}
		return d;
	}

	WaveFitter.prototype.drawData = function(){

		var g = this.svg.querySelector('#data-g');

		this.line = svgEl('path').appendTo(g).addClass('line data').attr({'id':'line-data','stroke-width':2,'fill':'none','d':makePath(this.data.dataH.lineData,this.scales)});

		this.data.plotSim = this.data.simNR.scale(this.mass,this.dist,this.data.dataH.t);
		this.sim = svgEl('path').appendTo(g).addClass('line sim').attr({'id':'line-data','stroke-width':2,'fill':'none','d':makePath(this.data.plotSim.lineData,this.scales)});

		return this;
	}

	function svgElement(t){
		this._el = document.createElementNS('http://www.w3.org/2000/svg',t);
		this.append = function(el){ this._el.appendChild(el); return this; };
		this.appendTo = function(el){ if(el._el){ el._el.appendChild(this._el); }else{ el.appendChild(this._el); } return this; };
		this.attr = function(obj,v){
			// Build an object from a key/value pair
			if(typeof obj==="string"){ key = obj; obj = {}; obj[key] = v; }
			for(key in obj) this._el.setAttribute(key,obj[key]);
			return this;
		};
		this.html = function(t){ this._el.textContent = t; return this; }
		this.addClass = function(cls){ this._el.classList.add(...cls.split(" ")); return this; };
		this.removeClass = function(){ this._el.classList.remove(...arguments); return this; };
		this.data = function(d){ this._data = d; return this; };
		return this;
	}
	function svgEl(t){ return new svgElement(t); }

	WaveFitter.prototype.addLegend = function(){

		var legg = svgEl('g').appendTo(this.svg).addClass('legend').attr('transform',"translate("+(this.scales.svgMargin.left+this.scales.svgWidth*0.05)+"," + (this.scales.svgMargin.top+this.scales.svgHeight*0.05) + ")");
		svgEl('line').appendTo(legg).addClass('line data').attr({'x1':0,'y1':0,'x2':(this.scales.svgWidth*0.05).toFixed(1),'y2':0});
		svgEl('text').appendTo(legg).addClass('leg-text data translate').attr({'x':(this.scales.svgWidth*0.07).toFixed(1),'y':0,'data-translate':'site.data.translations[text.legend.data][post.lang]'}).html(this.getTl('text.legend.data'));
		svgEl('line').appendTo(legg).addClass('line sim').attr({'x1':0,'y1':30,'x2':(this.scales.svgWidth*0.05).toFixed(1),'y2':30});
		svgEl('text').appendTo(legg).addClass('leg-text sim translate').attr({'x':(this.scales.svgWidth*0.07).toFixed(1),'y':30,'data-translate':'site.data.translations[text.legend.simulation][post.lang]'}).html(this.getTl('text.legend.simulation'));

		return this;
	}
	WaveFitter.prototype.updatePlot = function(dur=0){
		this.data.plotSim = this.data.simNR.scale(this.mass,this.dist,this.data.dataH.t);
		if(this.sim) this.sim.attr('d',makePath(this.data.plotSim.lineData,this.scales));
		return this;
	}
	WaveFitter.prototype.addSliders = function(){
		var _wf=this;

		var massdiv = document.querySelector('#'+this.holders.mass+' .param-slider-outer');
		if(!massdiv.querySelector('.param-slider')){
			mass_slider = document.createElement('div');
			mass_slider.classList.add('param-slider');
			mass_slider.setAttribute('id','mass-slider');
			massdiv.appendChild(mass_slider);

			var massrange=[];
			for (var v=_wf.ranges.mass[0];v<=_wf.ranges.mass[1];v+=10){massrange.push(v);}
			var pipFormats={'0':'a','1':'b'};
			noUiSlider.create(mass_slider, {
				start: [_wf.mass],
				connect: true,
				range: {
					'min': _wf.ranges.mass[0],
					'max': _wf.ranges.mass[1]
				},
				tooltips:[true],
				pips: {mode: 'positions', values: [0,100],density:100,},
			} );
			mass_slider.noUiSlider.on('update',function(values,handle){
				var value = values[handle];
				_wf.mass=value;
				_wf.updatePlot(0);
			});
			mass_slider.querySelector('.noUi-value').addEventListener('click',function(e){
				mass_slider.noUiSlider.set(Number(this.getAttribute('data-value')))
			});
		}

		
		var distdiv = document.querySelector('#'+this.holders.dist+' .param-slider-outer');
		if(!distdiv.querySelector('.param-slider')){
			dist_slider = document.createElement('div');
			dist_slider.classList.add('param-slider');
			dist_slider.setAttribute('id','dist-slider');
			distdiv.appendChild(dist_slider);

			var distrange=[];
			for (var v=_wf.ranges.dist[0];v<=_wf.ranges.dist[1];v+=100){distrange.push(v);}
			noUiSlider.create(dist_slider, {
				start: [_wf.dist],
				connect: true,
				range: {
					'min': _wf.ranges.dist[0],
					'max': _wf.ranges.dist[1]
				},
				tooltips:[true],
				pips: {mode: 'positions', values: [0,100],density:100}
			});
			dist_slider.noUiSlider.on('update',function(values,handle){
				var value = values[handle];
				_wf.dist=value;
				_wf.updatePlot(100);
			})
			dist_slider.querySelector('.noUi-value').addEventListener('click',function(e){
				dist_slider.noUiSlider.set(Number(this.getAttribute('data-value')))
			});
		}
		return this;
	}


	function showAbout(){
		var el = document.getElementById('about');
		el.classList.add('on');
	}
	function hideAbout(){
		var el = document.getElementById('about');
		el.classList.remove('on');
	}

	function clone(el){
		return JSON.parse(JSON.stringify(el));
	}

	root.WaveFitter = WaveFitter;

})(window || this);
