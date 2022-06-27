/*
	Graph 0.1
*/
(function(root){


	function Graph(el,opt){
		if(!el){
			console.error('No element to attach Graph to ',el,opt);
			return this;
		}
		this.el = el;
		this.opt = opt||{};
		if(!this.opt.getText || typeof this.opt.getText!=="function") this.opt.getText = function(t){ return t; };
		this.scales = {};
		this.axes = {};
		this.series = [];
		this.init();
		return this;
	}
	Graph.prototype.init = function(){
		this.el.innerHTML = '';	// Zap existing content

		// Create SVG holder
		this.svg = {};
		if(this.el.querySelector('svg')){
			this.svg.el = this.el.querySelector('svg');
		}else{
			this.svg.el = document.createElementNS('http://www.w3.org/2000/svg','svg');
			this.el.appendChild(this.svg.el);
		}
		this.svg.el.classList.add('graph');

		return this;
	};
	Graph.prototype.update = function(){

		var tempsvg = null;

		if(this.svg && this.svg.el){
			// Remove the element so we can work out the size of the container
			tempsvg = this.el.removeChild(this.svg.el);
		}

		this.scales.svgWidth = Math.floor(this.el.offsetWidth);
		this.scales.svgHeight = this.el.offsetHeight||Math.floor(this.scales.svgWidth/2);
		this.scales.svgMargin = {'left':75,'right':18,'top':10,'bottom':60};
		this.scales.graphWidth = this.scales.svgWidth-this.scales.svgMargin.left-this.scales.svgMargin.right;
		this.scales.graphHeight = this.scales.svgHeight-this.scales.svgMargin.top-this.scales.svgMargin.bottom;

		if(tempsvg) this.el.appendChild(tempsvg);
		
		this.svg.el.setAttribute('width',(this.scales.svgWidth));
		this.svg.el.setAttribute('height',(this.scales.svgHeight));

		if(!this.svg.defs) this.svg.defs = svgEl('defs').appendTo(this.svg.el);

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
			'height': this.scales.graphHeight,
			'range': [0.2,1]
		};
		if(!this.svg.xaxis){
			// Make x-axis
			this.svg.xaxis = svgEl('g').appendTo(this.svg.el).addClass("x-axis axis").attr({'id':'x-axis-g'});
			this.axes.x = new Axis(this.svg.xaxis,xprops,svgEl('text').addClass("x-axis axis-label translate").attr({'dominant-baseline':'hanging','text-anchor':'middle','data-translate':'site.translations[text.axis.time][site.lang]'}).html(this.opt.getText('text.axis.time')));
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
			'height': this.scales.graphHeight,
			'range': [-3,3]
		};
		if(!this.svg.yaxis){
			// Make y-axis
			this.svg.yaxis = svgEl('g').appendTo(this.svg.el).addClass("y-axis axis").attr({'id':'y-axis-g'});
			this.axes.y = new Axis(this.svg.yaxis,yprops,svgEl('text').addClass("y-axis axis-label translate").attr({'dominant-baseline':'hanging','transform':'rotate(-90)','text-anchor':'middle','data-translate':'site.translations[text.axis.strain][site.lang]'}).html(this.opt.getText('text.axis.strain')));
		}else{
			this.axes.y.setDomain(this.scales.graphHeight,0).setProps(yprops).updateSize();
		}
		this.svg.yaxis.attr({'transform': "translate("+this.scales.svgMargin.left+"," + this.scales.svgMargin.top + ")"});
		if(this.axes.y.label) this.axes.y.label.attr({'x':-this.scales.graphHeight/2,'y':(-this.scales.svgMargin.left*0.95 + 5)+'px',"font-size":(this.scales.svgMargin.left/4)+"px"});

		// Make data
		if(!this.svg.data) this.svg.data = svgEl("g").appendTo(this.svg.el).attr({"id":"data-g",'clip-path':'url(#clip)'});
		this.svg.data.attr({"transform":"translate("+this.scales.svgMargin.left+","+(this.scales.svgMargin.top) + ")"});
		this.drawData();

		// Make legend
		if(!this.svg.legend){
			this.svg.legend = svgEl('g').appendTo(this.svg.el).addClass('legend');
			this.svg.legenditems = [];
		}
		// Update legend position
		this.svg.legend.attr('transform',"translate("+(this.scales.svgMargin.left+10)+"," + (this.scales.svgMargin.top+20) + ")");

		// Add legend items
		var s,y,cls,txt,i;
		// Remove existing legend items (last to first)
		for(i = this.svg.legenditems.length-1 ; i >= 0; i--){
			if(this.svg.legenditems[i]){
				if(this.svg.legenditems[i].line) this.svg.legenditems[i].line._el.parentNode.removeChild(this.svg.legenditems[i].line._el);
				if(this.svg.legenditems[i].text) this.svg.legenditems[i].text._el.parentNode.removeChild(this.svg.legenditems[i].text._el);
				this.svg.legenditems.splice(i,1);
			}
		}
		y = 0;
		// Add each series item to the legend
		for(s = 0; s < this.series.length; s++, y+=30){
			if(this.series[s]){
				cls = (this.series[s].opt.class ? ' '+this.series[s].opt.class : '');
				txt = this.series[s].opt.text||'text.legend.data';
				this.svg.legenditems[s] = {
					'line':svgEl('line').appendTo(this.svg.legend).addClass('line'+cls).attr({'x1':0,'x2':(50).toFixed(1),'y1':y,'y2':y}),
					'text':svgEl('text').appendTo(this.svg.legend).addClass('leg-text translate'+cls).attr({'x':(50 + 10).toFixed(1),'y':y,'data-translate':'site.translations['+txt+'][site.lang]'}).html(this.opt.getText(txt))
				};
				if(this.series[s].opt.fill){
					this.svg.legenditems[s].line.attr({'fill':this.series[s].opt.fill});
				}
				if(this.series[s].opt.stroke){
					this.svg.legenditems[s].line.attr({'stroke':this.series[s].opt.stroke});
					this.svg.legenditems[s].text.attr({'fill':this.series[s].opt.stroke});
				}
			}
		}

		return this;
	};
	Graph.prototype.updateData = function(){
		if(this.axes.x) this.axes.x.setScale((new Range(this.axes.x.getRange()[0],this.axes.x.getRange()[1])).domain(0, this.scales.graphWidth));
		if(this.axes.y) this.axes.y.setScale((new Range(this.axes.y.getRange()[0],this.axes.y.getRange()[1])).domain(this.scales.graphHeight, 0));
		return this;
	};

	Graph.prototype.setSeries = function(i,d,opt){
		this.series[i] = new Series(d,opt);
		return this;
	};

	Graph.prototype.drawData = function(){
		var s,cls,d,id;
		if(!this.svg.series) this.svg.series = [];
		for(s = 0; s < this.series.length; s++){
			if(this.series[s]){
				cls = (this.series[s].opt.class ? ' '+this.series[s].opt.class : '');
				id = (this.series[s].opt.id ? this.series[s].opt.id : 'line-'+s);
				if(typeof this.svg.series[s]!=="object") this.svg.series[s] = {};
				if(typeof this.svg.series[s].line==="undefined"){
					this.svg.series[s].line = svgEl('path').appendTo(this.svg.data).addClass('line'+cls).attr({'id':id,'stroke-width':2,'fill':'none'});
					if(this.series[s].opt.fill) this.svg.series[s].line.attr({'fill':this.series[s].opt.fill});
					if(this.series[s].opt.stroke) this.svg.series[s].line.attr({'stroke':this.series[s].opt.stroke});
				}
				if(this.series[s].data.length==1){
					// Draw a line
					d = makePath(this.series[s].data[0].lineData,this.axes);
				}else if(this.series[s].data.length==2){
					// Make a filled shape
					d = makePath(this.series[s].data[0].lineData,this.axes);
					d += 'L'+makePath(this.series[s].data[1].lineData,this.axes,true).substr(1);
				}
				this.svg.series[s].line.attr({'d':d});
			}
		}
		var xr = this.axes.x.getRange();
		if(typeof xr==="object" && xr.length == 2) this.axes.x.setTickSpacing(defaultSpacing(xr[0],xr[1],8));

		return this;
	};
	
	function Series(d,opt){
		this.original = d;
		this.data = [];
		this.opt = opt||{};
		
		this.data.push(new WaveData(d));

		// Is the data a range?
		if(this.opt.range) this.data.push(new WaveData(d));
		
		for(var i = 0; i < this.data.length; i++){
			if(typeof this.opt.scale==="function") this.data[i].scale = this.opt.scale;
			if(typeof this.opt.scaleLine==="function") this.data[i].scaleLine = this.opt.scaleLine;
		}
		return this;
	}

	function Range(min,max){
		if(typeof min==="object" && min.length==2){
			max = min[1];
			min = min[0];
		}
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
		constructor(datain,mass=65,dist=420){
			this.t0 = 0.423;
			this.M0 = (mass) ? mass : 65;
			this.D0 = (dist) ? dist : 420;
			this.mass = this.M0;
			this.dist = this.D0;

			if(Array.isArray(datain)){
				if((datain.length>0) && (datain[0].length>=2)){
					this.t=datain.map(function(value,index){return value[0];});
					this.h=datain.map(function(value,index){return value[1];});
				}else{
					console.error("datain needs to be 2D array with dimension Nx2 for N datapoints",datain);
					return(null);
				}
			}else{
				if(datain.hasOwnProperty('t') && datain.hasOwnProperty('t')){
					this.t = datain.t;
					this.h = datain.h;
				}else{
					console.error("datain needs to be 2D array or object with data in properties t and h");
					return(null);
				}
			}
			this.linedata();
		}
		scale(){ return 1; }
		scaleLine(){ return; }
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
					i0 = Math.floor(idx);
					i1 = Math.ceil(idx);
					di = idx%1;
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

	function Axis(el,props,label){

		var tick,translate,attrline,attrtext,range;
		el.attr({'fill':'none','font-size':'10','font-family':'sans-serif','text-anchor':(props.dir=="left") ? 'end' : 'middle'});
		
		if(!props) props = {};
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
		};
		this.setRange = function(a,b){
			var min,max,i;
			if(typeof a==="number" && typeof b==="number"){
				min = a;
				max = b;
			}else{
				min = 1e100;
				max = -1e100;
				for(i = 0; i < a.data.length; i++){
					if(a.data[i][props.key]){
						min = Math.min(a.data[i][props.key][0],min);
						max = Math.max(a.data[i][props.key][a.data[i][props.key].length - 1],max);
					}
				}
			}
			range = [min,max];
			return this;
		};
		this.getRange = function(){
			return range||props.range;
		};
		this.setTickSpacing = function(s){
			props.ticks.spacing = s;
			return this.updateDP().updateTicks();
		};
		this.setProps = function(p){
			if(typeof p==="object") props = p;
			else props = {};
			this.key = props.key||"";
			return this.updateDP();
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
			if(this.scale){
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
	root.Graph = Graph;

})(window || this);
