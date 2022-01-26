/*
	Language Updater - updates Liquid/Jekyll style variables
	Version 0.1
*/
(function(root){
	
	if(!root.ready){
		root.ready = function(fn){
			// Version 1.1
			if(document.readyState != 'loading') fn();
			else document.addEventListener('DOMContentLoaded', fn);
		};
	}

	function Lang(opt){

		this.lang = (navigator ? (navigator.userLanguage||navigator.systemLanguage||navigator.language||browser.language) : "en");
		var _content = document.documentElement.outerHTML;
		var _obj = this;

		function init(){
			console.info('Lang.getLanguages');
			fetch("_data/languages.yml").then(response => {
				if(!response.ok) throw new Error('Network response was not OK');
				return response.text();
			}).then(txt => {
				//this._languages = txt;
				_obj.languages = parseYAML(txt);
				// If the language code doesn't exist check if a version of it without a hyphen exists
				if(!_obj.languages[_obj.lang] && _obj.lang.indexOf("-") > 0) _obj.lang = _obj.lang.replace(/\-.*/g,"");
				// If the language code still doesn't exist set it to Welsh (default)
				if(!_obj.languages[_obj.lang]) _obj.lang = "cy";
				_obj.updatePicker();
				_obj.getLanguageData();
			}).catch(error => {
				console.error('There has been a problem with your fetch operation:', error);
			});
			return _obj;
		};
		this.updatePicker = function(){
			if(opt.picker){
				var sel = "";
				for(var lang in _obj.languages) sel += '<option lang="'+lang+'" value="'+lang+'"'+(lang==_obj.lang ? ' selected' : '')+'>'+_obj.languages[lang].label+'</option>';
				el = document.getElementById(opt.picker);
				if(el) el.innerHTML = sel;
				el.focus();
				el.addEventListener('change',function(e){ _obj.setLanguage(e.currentTarget.value); });
			}
		};
		this.getLanguageData = function(){
			console.info('Lang.getLanguageData');
			fetch("_data/translations.yml").then(response => {
				if(!response.ok) throw new Error('Network response was not OK');
				return response.text();
			}).then(txt => {
				//this._text = txt;
				this.translations = parseYAML(txt);
				this.setLanguage(this.lang);
			}).catch(error => {
				console.error('There has been a problem with your fetch operation:', error);
			});
			return this;
		};
		this.setLanguage = function(lang){
			this.lang = lang;
			console.info('Lang.setLanguage',lang);
			var html = _content+'';
			var post = {'lang':lang};
			var site = {'data':{'translations':this.translations}};
			html = html.replace(/\-\-\-/g,"").replace(/\{\{([^\}]*)\}\}/g,function(m,p1){
				var txt = "";
				txt = p1.replace(/\[([^\]]*)\]/,function(m,p1){
					if(p1.indexOf('text')==0 || p1.indexOf('data')==0) return "."+p1;
					return "";
				});
				try{
					return eval(txt);
				}catch(err){
					console.error('Value of '+txt+' does not evaluate.');
				}
				return "";
			})
			document.open();
			document.write('<!DOCTYPE html>'+html);
			document.close();
			
			if(opt && typeof opt.ready==="function") ready(function(){ _obj.updatePicker(); opt.ready.call(_obj); });
			
			return this;
		};

		init();
		return this;
	}

	root.Lang = Lang;

	/**
		Copy of Yeahml https://github.com/mourner/yeahml
	*/
	'use strict';

	const BREAK = 10;
	const SPACE = 32;
	const HASH = 35;
	const COLON = 58;
	const HYPHEN = 45;

	const SCALAR = 0;
	const BLOCK_MAP = 1;
	const KEY = 2;
	const VALUE = 3;
	const BLOCK_SEQ = 4;
	const BLOCK_ENTRY = 5;
	const BLOCK_END = 6;
	const DOCUMENT_END = 7;

	const types = ['SCALAR', 'BLOCK_MAP', 'KEY', 'VALUE', 'BLOCK_SEQ', 'BLOCK_ENTRY', 'BLOCK_END', 'DOCUMENT_END'];

	function handleIndents(blockType, indents, indent, pos, tokens) {
		if (indents.length === 0 || indent > indents[indents.length - 1]) {
			indents.push(indent);
			tokens.push(blockType, pos, pos);
		} else {
			while (indents.length && indent !== indents[indents.length - 1]) {
				indents.pop();
				tokens.push(BLOCK_END, pos, pos);
			}
		}
	}

	function tokenize(s) {
		let pos = 0;
		const tokens = [];
		const indents = [];
		const len = s.length;
		let indent = 0;

		while (pos <= len) {
			const start = pos;
			let c = s.charCodeAt(pos++);

			if (c === HASH) { // comment
				while (pos < len && s.charCodeAt(pos) !== BREAK) pos++;

			} else if (c === BREAK) { // line break; save indent
				while (pos < len && s.charCodeAt(pos) === SPACE) pos++;
				indent = pos - start - 1;

			} else if (c === SPACE) { // spaces; skip
				while (pos < len && s.charCodeAt(pos) === SPACE) pos++;

			} else if (c === HYPHEN && s.charCodeAt(pos) === SPACE) { // "- ": sequence entry
				pos++;
				indent++; // treat sequence entry as indented to support nested sequence on the same indentation
				handleIndents(BLOCK_SEQ, indents, indent, start, tokens); // possibly end blocks or start new one
				tokens.push(BLOCK_ENTRY, start, start);
				indent++; // treat following tokens as indented for compact notation

			} else if (c === HYPHEN && s.charCodeAt(pos) === BREAK) { // "-\n": indented sequence entry
				handleIndents(BLOCK_SEQ, indents, indent, start, tokens);
				tokens.push(BLOCK_ENTRY, start, start);

			} else { // scalar
				let numSpaces = 0;

				while (pos <= len) {
					c = s.charCodeAt(pos);

					// ends with line break, comment or EOF: scalar
					if (c === BREAK || pos === len || (c === HASH && numSpaces > 0)) {
						tokens.push(SCALAR, start, pos - numSpaces);
						break;

					} else if (c === COLON) { // possible map key
						c = s.charCodeAt(pos + 1);

						if (c === SPACE || c === BREAK) { // ends with ": " or ":\n": block key/value pair
							handleIndents(BLOCK_MAP, indents, indent, start, tokens); // possibly end blocks or start new one
							tokens.push(KEY, start, start);
							tokens.push(SCALAR, start, pos - numSpaces);
							tokens.push(VALUE, pos, pos);
							pos++;
							break;
						}
					}

					numSpaces = c === SPACE ? numSpaces + 1 : 0; // track trailing spaces
					pos++;
				}
			}
		}

		for (let i = 0; i < indents.length; i++) {
			tokens.push(BLOCK_END, len, len);
		}

		tokens.push(DOCUMENT_END, len, len);

		return tokens;
	}

	function parseTokens(s, tokens) {
		let i = 0;
		let nextType = tokens[0];
		let start, end;

		function accept(type) {
			if (nextType === type) {
				start = tokens[i + 1];
				end = tokens[i + 2];
				i += 3;
				nextType = tokens[i];
				return true;
			}
			return false;
		}

		function expect(expectedType) {
			if (!accept(expectedType)) throw new Error(`Expected ${types[expectedType]}, got ${types[nextType]}.`);
		}

		function block() {
			if (accept(SCALAR)) {
				return s.slice(start, end);

			} else if (accept(BLOCK_SEQ)) {
				const seq = [];
				while (accept(BLOCK_ENTRY)) seq.push(block());
				expect(BLOCK_END);
				return seq;

			} else if (accept(BLOCK_MAP)) {
				const map = {};
				while (accept(KEY)) {
					expect(SCALAR);
					const key = s.slice(start, end);
					expect(VALUE);
					map[key] = block();
				}
				expect(BLOCK_END);
				return map;

			} else {
				return null;
			}
		}

		return block();
	}

	function parse(s) {
		return parseTokens(s, tokenize(s));
	}

	root.parseYAML = parse;

})(window || this);
