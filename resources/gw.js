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


	root.GW = GW;

})(window || this);
