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

	class WaveData{
		constructor(datain){
			if (Array.isArray(datain)){
				if ((datain.length>0)&(datain[0].length>=2)){
					this.t=datain.map(function(value,index){return value[0]})
					this.h=datain.map(function(value,index){return value[1]})
				}else{
					console.log("datain needs to be 2D array with dimension Nx2 for N datapoints",datain.length,datain[0].length)
					return(null);
				}
			}else{
				if (datain.hasOwnProperty('t')&datain.hasOwnProperty('t')){
					this.t=datain.t;
					this.h=datain.h
				}else{
					console.log("datain needs to be 2D array or object with data in properties t and h")
					return(null);
				}
			}
			this.linedata();
		}
		linedata(){
			this.lineData=[];
			for (var i=0;i<this.t.length;i++){
				this.lineData.push({'t':this.t[i],'h':this.h[i]})
			}
			this.tint=d3.scaleLinear().range([0,this.t.length])
			this.tint.domain([this.t[0],this.t.slice(-1)])
		}
		getH(t){
			if (Array.isArray(t)){
				var h0=[];
				for (var i=0;i<t.length;i++){
					h0.push(this.getH(t[i]));
				}
			}else{
				var idx=this.tint(t);
				var h0;
				if (idx<0){
					h0=NaN;
				}else if(idx>this.t.length-1){
					h0=0;
				}else{
					let i0=Math.floor(idx), i1=Math.ceil(idx),di=idx%1;
					var h0=(1-di)*this.h[i0] + di*this.h[i1];
				};
			}
			return h0;
		}
		shiftt(t0){
			for (let i=0;i<this.t.length;i++){
				this.t[i]+=t0;
			}
			this.linedata();
		}
	}

	class ScaleableWaveData extends WaveData{
		constructor(datain,mass=65,dist=420){
			super(datain);
			this.t0=0.423;
			this.M0=65;
			this.D0=420;
			this.mass=(mass)?mass:65;
			this.dist=(dist)?dist:420;
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

		var _wf=this;
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

			this.addSliders();
			this.initGraph();

			// Re-attach the window event
			window.addEventListener('resize', this.resize );

			return this;
		};

		this.initData();


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
		this.data={dataH:new WaveData(dataH),simNR:new ScaleableWaveData(simNR)};
		this.ranges={mass:[20,100],dist:[100,800]}
		this.mass=this.ranges.mass[0] + Math.random()*(this.ranges.mass[1]-this.ranges.mass[0]);
		this.dist=this.ranges.dist[0] + Math.random()*(this.ranges.dist[1]-this.ranges.dist[0]);
		this.data.trange=[this.data.dataH.t[0],this.data.dataH.t.slice(-1)];
		// this.data.trange=[-0.2,0.8];
		this.data.hrange=[-2,2];
		return this;
	}

	WaveFitter.prototype.setScales = function(){
		this.scales={}
		this.scales.svgWidth=Math.floor(document.getElementById(this.holders.graph).offsetWidth);
		this.scales.svgHeight=document.getElementById(this.holders.graph).offsetHeight||Math.floor(this.scales.svgWidth/2);
		this.scales.svgMargin={'left':80,'right':10,'top':10,'bottom':80}
		this.scales.graphWidth=this.scales.svgWidth-this.scales.svgMargin.left-this.scales.svgMargin.right;
		this.scales.graphHeight=this.scales.svgHeight-this.scales.svgMargin.top-this.scales.svgMargin.bottom;
		
		// set axis scales
		this.scales.xScale = d3.scaleLinear().range([0, this.scales.graphWidth])
		this.scales.xScale.domain(this.data.trange)
		this.scales.xAxis = d3.axisBottom(this.scales.xScale)
			.tickSize(-this.scales.graphHeight)
		this.scales.yScale = d3.scaleLinear().range([this.scales.graphHeight,0]);
		this.scales.yScale.domain(this.data.hrange);
		this.scales.yAxis = d3.axisLeft(this.scales.yScale)
			.tickSize(-this.scales.graphWidth)
	}
	WaveFitter.prototype.initGraph = function(){
		var _wf=this;
		_wf.setScales();

		document.getElementById('about-button').addEventListener('click',function(){ showAbout(); });
		document.getElementById('about-close').addEventListener('click',function(){ hideAbout(); });
		document.getElementById(this.holders.graph).style.height = '';

		/* NEW
		var hid = document.getElementById(this.holders.graph);
		hid.innerHTML = "";
		_wf.svg = document.createElement('svg');
		_wf.svg.classList.add('graph');
		_wf.svg.style.width = (_wf.scales.svgWidth)+'px';
		_wf.svg.style.height = (_wf.scales.svgHeight)+'px';
		hid.appendChild(_wf.svg);
		*/
		var hid=d3.select('#'+this.holders.graph);
		hid.selectAll('*').remove();
		_wf.svg=hid.append('svg')
			.attr("class","graph")
			.attr("width", (_wf.scales.svgWidth)+'px')
			.attr("height", (_wf.scales.svgHeight)+'px');
			
		var clip = _wf.svg.append("defs").append("svg:clipPath")
			.attr("id", "clip")
			.append("svg:rect")
			.attr("width", _wf.scales.graphWidth )
			.attr("height", _wf.scales.graphHeight )
			.attr("x", 0)
			.attr("y", 0);
		
		// make x-axis
		_wf.svg.append("g")
			.attr("class", "x-axis axis")
			.attr("id","x-axis-g")
			.attr("transform", "translate("+_wf.scales.svgMargin.left+"," +
				(_wf.scales.graphHeight + _wf.scales.svgMargin.top) + ")");
		_wf.svg.select(".x-axis.axis").call(_wf.scales.xAxis)
		_wf.svg.select(".x-axis.axis").append('text')
			.attr("class", "x-axis axis-label translate")
			.attr('data-content','text.axis.time')
			.attr("x", _wf.scales.graphWidth/2)
			.attr("y", (_wf.scales.svgMargin.bottom/2)+"px")
			.style("font-size",(_wf.scales.svgMargin.bottom/4)+"px")
			.attr("text-anchor","middle")
			.text(_wf.getTl('text.axis.time'))
			
		// make y-axis
		_wf.svg.append("g")
			.attr("class", "y-axis axis")
			.attr("id","y-axis-g")
			.attr("transform", "translate("+_wf.scales.svgMargin.left+"," +
				_wf.scales.svgMargin.top + ")");
		
		_wf.svg.select(".y-axis.axis").call(_wf.scales.yAxis)
		_wf.svg.select(".y-axis.axis").append("text")
			.attr("class", "y-axis axis-label translate")
			.attr('data-content','text.axis.strain')
			.attr("transform", "rotate(-90)")
			.attr("y", 6)
			.attr("x",-_wf.scales.graphHeight/2)
			.attr("dy", (-_wf.scales.svgMargin.left/2)+"px")
			.style("font-size",(_wf.scales.svgMargin.left/4)+"px")
			.attr("text-anchor","middle")
			.text(_wf.getTl('text.axis.strain'));
		
		_wf.svg.append("g")
			.attr("id","data-g")
			.attr("transform", "translate("+_wf.scales.svgMargin.left+"," +
				(_wf.scales.svgMargin.top) + ")")
			.attr('clip-path','url(#clip)');
		
		_wf.drawData();
		_wf.addLegend();
	}

	WaveFitter.prototype.drawData = function(){
		var _wf=this;
		this.lineFn = d3.line()
			.x(function(d) { return _wf.scales.xScale(d.t); })
			.y(function(d) { return _wf.scales.yScale(d.h); })
		d3.select('#data-g').append('path')
			.data([_wf.data.dataH.lineData])
			.attr('class','line data')
			.attr('id','line-data')
			.attr('d',_wf.lineFn)
			.attr('stroke-width',2)
			.attr('fill','none')

		_wf.data.plotSim=_wf.data.simNR.scale(_wf.mass,_wf.dist,_wf.data.dataH.t);    
		d3.select('#data-g').append('path')
			.data([_wf.data.plotSim.lineData])
			.attr('class','line sim')
			.attr('id','line-sim')
			.attr('d',_wf.lineFn)
			.attr('stroke-width',2)
			.attr('fill','none')
	}
	WaveFitter.prototype.addLegend = function(){
		var _wf=this;
		var legg=this.svg.append('g')
			.attr('class','legend')
			.attr("transform", "translate("+(_wf.scales.svgMargin.left+_wf.scales.svgWidth*0.05)+"," +
				(_wf.scales.svgMargin.top+_wf.scales.svgHeight*0.05) + ")")
		legg.append('line')
			.attr('class','line data')
			.attr('x1',0)
			.attr('y1',0)
			.attr('x2',_wf.scales.svgWidth*0.05)
			.attr('y2',0)
		legg.append('text')
			.attr('class','leg-text data translate')
			.attr('data-content','text.legend.data')
			.attr('x',_wf.scales.svgWidth*0.07)
			.attr('y',0)
			.text(_wf.getTl('text.legend.data'))
		
		legg.append('line')
			.attr('class','line sim')
			.attr('x1',0)
			.attr('y1',30)
			.attr('x2',_wf.scales.svgWidth*0.05)
			.attr('y2',30)
		legg.append('text')
			.attr('class','leg-text sim translate')
			.attr('data-content','text.legend.simulation')
			.attr('x',_wf.scales.svgWidth*0.07)
			.attr('y',30)
			.text(_wf.getTl('text.legend.simulation'))
		
	}
	WaveFitter.prototype.updatePlot = function(dur=0){
		_wf=this;
		_wf.data.plotSim=_wf.data.simNR.scale(_wf.mass,_wf.dist,_wf.data.dataH.t);
		var path=d3.selectAll('#line-sim')
			.data([_wf.data.plotSim.lineData])
		path.transition()
			.duration(dur)
			.ease(d3.easeLinear)
			.attr('d',_wf.lineFn);
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
