(function (window) {

	/*
	Specs:

	- Rendering template can only contain 1 element
	- Rendering template may not cross 2 elements "> <input>"


	- Compiling the template can be expensive, but updating data should not be

	*/ 


	function Template(html) {
		var div = document.createElement('div');
		div.innerHTML = html;
		this._DOM = div.firstChild;

		processBindings(this._DOM);
	}

	Template.prototype.getDOM = function () {
		return this._DOM;
	};

	function processBindings(DOMObject) {
		var bindings = {};
		var attrBindings = AttrBinding.hasBindings(DOMObject);
		var innerHTMLBindings = MultipleInnerHTMLBinding.hasSingleBindings(DOMObject);

		for (var i = 0; i < DOMObject.childNodes.length; i++) {
			var childBindings = processBindings(DOMObject.childNodes[i]);

			for (var j in childBindings) {
				if (childBindings.hasOwnProperty(i)) {
					bindings[i] = childBindings[i];
				}
			}
		}

		for (var i in attrBindings) {
			if (attrBindings.hasOwnProperty(i)) {
				bindings[i] = attrBindings[i];
			}
		}

		for (var i in innerHTMLBindings) {
			if (innerHTMLBindings.hasOwnProperty(i)) {
				bindings[i] = innerHTMLBindings[i];
			}
		}

		return bindings;
	}

	/*

	DOM: the DOM object
	varName: the variable to bind to within the template
	type: the type (attribute/value?)


	*/

	// TODO: Do some two-way binding


	function AttrBinding(DOM, attrName, varName, templateString) {
		this.DOM = DOM;
		this.attrName = attrName;
		this.varName = varName;
	}

	AttrBinding.prototype.set = function (val) {
		this.DOM.setAttribute(attrName, templateString.replace("<%=varName%>", varName));
		this.val = val;
	};

	AttrBinding.prototype.get = function () {
		return this.val;
	};

	AttrBinding.hasBindings = function (DOM) {
		// TODO
	};

	// Works for HTML 

	function MultipleInnerHTMLBinding(DOM, templateString) {
		// TODO: parse varnames from templateString


		this.DOM = DOM;
		this.varName = varName;
	}

	TextBinding.prototype.set = function (var, val) {
		this.DOM.innerHTML = templateString
	};

	TextBinding.prototype.getSingleBindings = function () {
		//TODO
	};

	MultipleInnerHTMLBinding.hasBindings = function (DOM) {
		// TODO
	};

	function SingleInnerHTMLBinding(parent, varName) {
		this.parent = parent;
	}

	SingleTextBinding.prototype.set = function (val) {
		this.parent.set(this.varName, val);
	};





	function SubViewBinding {
		// TODO

	}




	function CSSBinding() {
		// TODO: To be implemented since CSS is different from a normal
		//       attribute in the sense that it is kind of a list
	}

})(window);