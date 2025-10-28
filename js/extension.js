(function() {
  class ButtonInput extends window.Extension {
    constructor() {
      	super('buttoninput');
		//console.log("Adding buttoninput addon to menu");
      	this.addMenuEntry('Button Input');

      	this.content = '';
        this.debug = false;
		
		this.item_elements = ['limit1','limit2','thing1','property1','limit3','limit4','thing2','property2'];
		this.all_things;
		this.items_list = [];
		
		this.item_number = 0;
		
		this.persistent_data = null;
		
		this.update_countdown = 0;
		this.received_poll = true;
		
		this.jwt = localStorage.getItem('jwt');
		

		fetch(`/extensions/${this.id}/views/content.html`)
        .then((res) => res.text())
        .then((text) => {
         	this.content = text;
			if( document.location.href.endsWith("/extensions/buttoninput") ){
                //console.log('buttoninput: calling this.show from constructor init because at /buttoninput url');
				this.show();
			}
        })
        .catch((e) => console.error('Failed to fetch content:', e));
    }



    show() {
        //console.log("buttoninput show called");
        if(this.content == ''){
            //console.log('show called, but content was still empty. Aborting.');
            return;
        }
        const view = document.getElementById('extension-buttoninput-view'); 
        //console.log("buttoninput html: ", this.content);
		this.view.innerHTML = this.content;
	  	
		const content_el = document.getElementById('extension-buttoninput-content');
		
		
		this.add_button = document.getElementById('extension-buttoninput-add-button');
		
		if(this.add_button){
			this.add_button.addEventListener('click', () => {
				if(this.update_countdown > 0){
					this.update_countdown = 0;
					this.add_button.innerHTML = '';
					if(content_el){
						content_el.classList.remove('extension-buttoninput-busy-scanning')
					}
					
				}
				else{
					this.update_countdown = 40;
					this.add_button.innerHTML = this.update_countdown;
					if(content_el){
						content_el.classList.add('extension-buttoninput-busy-scanning')
					}
	    	  		this.get_input_data();
				}
					
			})
		}
		
		content_el.poller = setTimeout(() => {
			if(this.update_countdown == 0){
				if(this.received_poll){
					this.received_poll = false;
	    	        window.API.postJson(
	    	          `/extensions/${this.id}/api/ajax`,
	                    {	'action':'poll'
						}

	    	        ).then((body) => {
						this.received_poll = true;
						if(typeof body.input_data != 'undefined'){
							console.log("buttoninput: poll: received updated device data: ", body.input_data);
							this.handle_input_data(body.input_data);
						}
					
	    	        }).catch((err) => {
	    	          	console.error("buttoninput: caught error doing poll: ", err);
						this.received_poll = true;
	    	        });	
						
						
				}
				
			}
			
			
		},3000);
		
		
		/*
        setTimeout(() => {
    		const pre = document.getElementById('extension-buttoninput-response-data');
		
    		//const original = document.getElementById('extension-buttoninput-original-item');
    		//const list = document.getElementById('extension-buttoninput-list');
    		const leader_dropdown = document.querySelectorAll(' #extension-buttoninput-view #extension-buttoninput-original-item .extension-buttoninput-thing1')[0];
    		const follower_dropdown = document.querySelectorAll(' #extension-buttoninput-view #extension-buttoninput-original-item .extension-buttoninput-thing2')[0];
	    
            if(leader_dropdown == null){
                console.log("Something is wrong, leader_dropdown does not exist");
            }
            else{
                //console.log("leader dropdown existed");
            }
        
            if(pre != null){
                //pre.innerText = "";
            }
		
		
    	  	// Click event for ADD button
            if(document.getElementById("extension-buttoninput-add-button") != null){
        		document.getElementById("extension-buttoninput-add-button").addEventListener('click', () => {
        			this.items_list.push({'enabled': false});
        			this.regenerate_items();
        			view.scrollTop = view.scrollHeight;
        	  	});
            }
            else{
                console.log('buttoninput: something is wrong, cannot find add button, buttoninput HTML was not loaded?');
            }

		

    		// Pre populating the original item that will be clones to create new ones
    	    API.getThings().then((things) => {
			
                function compare(a, b) {
                    
                  const thingA = a.title.toUpperCase();
                  const thingB = b.title.toUpperCase();

                  if (thingA > thingB) {
                    return 1;
                  } else if (thingA < thingB) {
                    return -1;
                  }
                  return 0;
                }

                things.sort(compare);
                //console.log("sorted things: ", things);
            
    			this.all_things = things;
    			//console.log("buttoninput: all things: ", things);
    			//console.log(things);
			
			
    			// pre-populate the hidden 'new' item with all the thing names
    			var thing_ids = [];
    			var thing_titles = [];
			
    			for (let key in things){

    				var thing_title = 'unknown';
    				if( things[key].hasOwnProperty('title') ){
    					thing_title = things[key]['title'];
    				}
    				else if( things[key].hasOwnProperty('label') ){
    					thing_title = things[key]['label'];
    				}
				
    				//console.log(thing_title);
    				try{
    					if (thing_title.startsWith('highlights-') ){
    						// Skip highlight items
    						continue;
    					}
					
    				}
    				catch(e){
                        //console.log("error in creating list of things for highlights: " + e);
                    }
			
    				var thing_id = things[key]['href'].substr(things[key]['href'].lastIndexOf('/') + 1);
    				try{
    					if (thing_id.startsWith('highlights-') ){
    						// Skip items that are already highlight clones themselves.
    						//console.log(thing_id + " starts with highlight-, so skipping.");
    						continue;
    					}
					
    				}
    				catch(e){
                        console.log("error in creating list of things for item: " + e);
                    }
    				thing_ids.push( things[key]['href'].substr(things[key]['href'].lastIndexOf('/') + 1) );
				

    				// for each thing, get its property list. Only add it to the selectable list if it has properties that are numbers. 
    				// In case of the second thing, also make sure there is at least one non-read-only property.
    				const property_lists = this.get_property_lists(things[key]['properties']);
				
    				if(property_lists['property1_list'].length > 0){
    					//console.log("adding thing to source list because a property has a number");
    					leader_dropdown.options[leader_dropdown.options.length] = new Option(thing_title, thing_id);
    					if(property_lists['property2_list'].length > 0){
    						//console.log("adding thing to target list because a property can be written");
    						follower_dropdown.options[follower_dropdown.options.length] = new Option(thing_title, thing_id);
    					}	
    				}
    			}
			
                
                
    	  		// Get list of items
    	        window.API.postJson(
    	          `/extensions/${this.id}/api/ajax`,
                    {'action':'init', 'jwt':this.jwt}

    	        ).then((body) => {
                
                    if(typeof body.debug != 'undefined'){
                        this.debug = body.debug;
                        if(body.debug){
                            console.log("buttoninput init response: ", body);
                            document.getElementById('extension-buttoninput-debug-warning').style.display = 'block';
                        }
                    }
                
                    if(typeof body.ready != 'undefined'){
                        if(body.ready){
            				if(body['state'] == 'ok'){
            					this.items_list = body['items']
            					this.regenerate_items();
            				}
                        }
                        else{
                            document.getElementById('extension-buttoninput-not-ready-warning').style.display = 'block';
                        }
                    }
					
					this.get_input_data();
                

    	        }).catch((err) => {
    	          	console.error("caught error doing init API action:  ", err);
    	        });
				
    	    });
            
        }, 100);

		*/
		
		
		let rescan_button_el = document.getElementById('extension-buttoninput-rescan-button');
		if(rescan_button_el){
			rescan_button_el.addEventListener('click', () => {
				
    	  		// Get list of items
    	        window.API.postJson(
    	          `/extensions/${this.id}/api/ajax`,
                    {	'action':'rescan',
						'jwt':this.jwt
					}

    	        ).then((body) => {
                	//console.log("rescan response: ", body);
					
					if(typeof body.persistent_data != 'undefined'){
						this.persistent_data = body.persistent_data;
					}
					
					if(typeof body.input_data != 'undefined'){
						this.handle_input_data(body.input_data);
					}
                    
    	        }).catch((err) => {
    	          	console.error("caught error calling API rescan action: ", err);
    	        });	
				
			})
		}
		else{
			console.error("no rescan button found");
		}


		const save_button_el = document.getElementById('extension-buttoninput-save-button');
		if(save_button_el){
			save_button_el.style.display = 'none';
			save_button_el.addEventListener('click', () => {
				//console.log("clicked on save_persistent_data button");
				save_button_el.style.display = 'none';
				
    	  		// Get list of items
    	        window.API.postJson(
    	          `/extensions/${this.id}/api/ajax`,
                    {	'action':'save_persistent_data',
						'persistent_data':this.persistent_data
					}

    	        ).then((body) => {
                	//console.log("save_persistent_data response: ", body);
					
					if(typeof body.state == 'boolean' && body.state == true){
						//save_button_el.style.display = 'none';
						/*
						save_button_el.classList.add('extension-buttoninput-overview-button-succes');
						setTimeout(() => {
							save_button_el.classList.remove('extension-buttoninput-overview-button-succes');
						},1000);
						*/
						
					}
					
					/*
					if(typeof body.persistent_data != 'undefined'){
						this.persistent_data = body.persistent_data;
					}
					
					if(typeof body.input_data != 'undefined'){
						this.handle_input_data(body.input_data);
					}
					*/
                    
    	        }).catch((err) => {
    	          	console.error("caught error calling API save_persistent_data action: ", err);
					save_button_el.style.display = 'block';
    	        });	
				
			})
		}


		
		/*
		let update_button_el = document.getElementById('extension-buttoninput-update-button');
		if(update_button_el){
			update_button_el.addEventListener('click', () => {
				this.update_countdown = 40;
				this.add_button.innerHTML = ''
    	  		this.get_input_data();
				
			})
		}
		else{
			console.error("no rescan button found");
		}
		*/
		

		this.get_input_data();

	}
	
	
	
	
	
	get_input_data(){
		
		//console.log("in get_input_data");
		
  		// Get updated data
        window.API.postJson(
          `/extensions/buttoninput/api/ajax`,
            {	'action':'get_input_data',
				'jwt':this.jwt
			}

        ).then((body) => {
        	//console.log("get_input_data response: ", body);
			
			if(typeof body.persistent_data != 'undefined' && body.persistent_data != null){
				this.persistent_data = body.persistent_data;
			}
			
			if(typeof body.input_data != 'undefined'){
				this.handle_input_data(body.input_data);
			}
			if(this.update_countdown > 0){
				this.update_countdown--;
				if(this.add_button){
					this.add_button.innerHTML = this.update_countdown;
				}
				setTimeout(() => {
					this.get_input_data()
				},1000);
			}
			else{
				if(this.add_button){
					this.add_button.innerHTML = '';
				}
				const content_el = document.getElementById('extension-buttoninput-content');
				if(content_el){
					content_el.classList.remove('extension-buttoninput-busy-scanning')
				}
			}
			
            
        }).catch((err) => {
          	console.error("caught error calling API get_input_data action: ", err);
			
			const error_el = document.getElementById('extension-buttoninput-overview-error');
			if(error_el){
				error_el.style.display = 'block';
				setTimeout(() => {
					error_el.style.display = 'none';
				},10000);
			}
			
			/*
			setTimeout(() => {
				this.get_input_data()
			},3000);
			*/
        });	
	}
	
	
	
	handle_input_data(input_data){
		
		//console.log("buttoninput: in handle_input_data.  input_data: ", input_data);
		//console.log("buttoninput: in handle_input_data.  persistent_data: ", this.persistent_data);
		
		const overview_el = document.getElementById('extension-buttoninput-overview');
		if(overview_el){
			overview_el.innerHTML = '';
			
			const save_button_el = document.getElementById('extension-buttoninput-save-button');
			
			let scrolled_into_view = false;
			
			function generate_explanation(details){
				//console.log("in generate_explanation. details: ", details);
				let explanation = '';
				if(details && typeof details['latching'] == 'number'){
					
					if(details['latching'] > 1){
						explanation = 'Each time you press this button, it will increase a value until it reaches ' + details['latching'] + ".";
						
						if(typeof details['opposite'] == 'string'){
							explanation += ' Pressing the "' + details['opposite'].replace('KEY_','') + '" button will decrease that value, until it reaches zero.'
						}
						else{
							explanation += " If you then press it again, it will loop back to zero."
						}
						
					}
					else if(details['latching'] == 1){
						if(typeof details['opposite'] == 'string'){
							explanation = " Pressing this button will switch this property on, and pressing the negative opposite button will toggle it off."
						}
						else{
							explanation = " Pressing this button will switch this property on, and pressing it again will turn it off again."
						}
					}
					
					//if(explanation == ''){
					//	explanation = 'A normal button';
					//}
				}
				else{
					//console.warn("generate_explanation: no latching value in provided details: ", details);
				}
				return explanation;
			}
			
			
			for (let [key, value] of Object.entries(input_data)){
				
				/*
				let title_el = document.createElement('h2');
				title_el.textContent = value.nice_name;
				overview_el.appendChild(title_el);
				
				if(this.debug && typeof value.full_name == 'string'){
					let event_id_el = document.createElement('p');
					event_id_el.textContent = value.path;
					overview_el.appendChild(event_id_el);
				}
				*/
				
				//console.log("typeof value.capabilities: ", typeof value.capabilities, value.capabilities);
				
				const nice_name = value.nice_name;
				//console.log("nice_name: ", nice_name);
				
				let opposite_dropdown_list = [];
				
				const process_tree = (node_name, node, element,depth=1) => {
					//console.log("in process_tree.  node_name, node: ", node_name, node);
					//console.log("root key: ", key);
				    var li = document.createElement('li');
					
					const li_title_el = document.createElement('h' + depth);
					
					const li_title_span_el = document.createElement('span');
					
					let latch_explanation_container_el = document.createElement('li');
					latch_explanation_container_el.classList.add('extension-buttoninput-overview-explanation');
					//let latch_explanation_part1 = document.createElement('span');
					//let latch_explanation_part2 = document.createElement('span');
					
					
					
					let display_name = node_name.replace('buttoninput','').replaceAll('_',' ');
					
					if(node_name.endsWith('ABS')){
						display_name = 'Positions';
						li_title_el.classList.add('extension-buttoninput-overview-abs');
					}
					else if(node_name.endsWith('KEY')){
						display_name = 'Buttons';
						li_title_el.classList.add('extension-buttoninput-overview-key');
					}
					else if(node_name.endsWith('SYN')){
						display_name = 'Synchronisations';
						li_title_el.classList.add('extension-buttoninput-overview-syn');
					}
					else if(node_name.endsWith('MSC')){
						display_name = 'Miscelaneous';
						li_title_el.classList.add('extension-buttoninput-overview-msc');
					}
					else if(node_name.endsWith('FF')){
						display_name = 'Effects';
						li_title_el.classList.add('extension-buttoninput-overview-ff');
					}
					else if(node_name.startsWith('BTN_')){
						display_name = node_name.replace('BTN_','');
						li_title_el.classList.add('extension-buttoninput-overview-key');
					}
					else if(node_name.startsWith('KEY_')){
						display_name = node_name.replace('KEY_','');
						li_title_el.classList.add('extension-buttoninput-overview-key');
					}
					else if(node_name.startsWith('ABS_')){
						display_name = node_name.replace('ABS_','');
						li_title_el.classList.add('extension-buttoninput-overview-abs');
					}
					else if(node_name.startsWith('SYN_')){
						display_name = node_name.replace('SYN_','');
						li_title_el.classList.add('extension-buttoninput-overview-syn');
					}
					else if(node_name.startsWith('MSC_')){
						display_name = node_name.replace('MSC_','');
						li_title_el.classList.add('extension-buttoninput-overview-msc');
					}
					else if(node_name.startsWith('FF_')){
						display_name = node_name.replace('FF_','');
						li_title_el.classList.add('extension-buttoninput-overview-ff');
					}
					
					if(display_name.startsWith('EV_')){
						display_name = display_name.replace('EV_','');
					}
					//node_name = display_name;
					
				    li_title_span_el.textContent = display_name;
					li_title_el.appendChild(li_title_span_el);
					
					
					if(depth == 3){
						opposite_dropdown_list = Object.keys(node);
						console.log("opposite_dropdown_list is now: ", opposite_dropdown_list);
					}
					
					
					
					if(depth == 4){
						li_title_el.addEventListener('click', () => {
							//console.log("clicked on overview item.  node_name: ", node_name, node);
							//console.log("this.persistent_data: ", this.persistent_data);
							
							if(typeof node == 'number'){
								//console.log("node is a number");
							}
							
							
							if(typeof this.persistent_data['things'] == 'undefined'){
								this.persistent_data['things'] = {};
							}
							
							if(typeof this.persistent_data['things'][nice_name] == 'undefined'){
								this.persistent_data['things'][nice_name] = {};
							}
							
							if(typeof this.persistent_data['things'][nice_name][node_name] == 'undefined'){
								this.persistent_data['things'][nice_name][node_name] = {};
							}
							else{
								//console.warn("nice, button already exists in persistent data: ", this.persistent_data['things'][nice_name][node_name]);
							}
							
							if(typeof this.persistent_data['things'][nice_name][node_name]['enabled'] == 'undefined'){
								this.persistent_data['things'][nice_name][node_name]['enabled'] = true;
							}
							
							
							if(li_title_el.classList.contains('extension-buttoninput-overview-selected')){
								li_title_el.classList.remove('extension-buttoninput-overview-selected');
								this.persistent_data['things'][nice_name][node_name]['enabled'] = false;
								
							}
							else{
								li_title_el.classList.add('extension-buttoninput-overview-selected');
								this.persistent_data['things'][nice_name][node_name]['enabled'] = true;
								
								if(typeof node.min == 'number' && typeof node.max == 'number'){
									this.persistent_data['things'][nice_name][node_name]['min'] = node.min;
									this.persistent_data['things'][nice_name][node_name]['max'] = node.max;
								}
								if(typeof node.value == 'number'){
									this.persistent_data['things'][nice_name][node_name]['value'] = node.value;
								}
								
							}
							
							
							if(save_button_el){
								save_button_el.style.display = 'block';
							}
							
						})
					}
					
					
					
					
					
					
					
					
					if(typeof node == 'number'){ // typeof node.value != 'undefined' || 
						//console.warn("FOUND VALUE!: ", node_name, node.value, node);
						const li_value_el = document.createElement('span');
						
						if(typeof node.value != 'undefined'){
							li_value_el.textContent = '' + node.value;
							li_value_el.classList.add('extension-buttoninput-overview-big-value');
						}
						if(typeof node == 'number'){
							li_value_el.textContent = '' + node;
							li_value_el.classList.add('extension-buttoninput-overview-value');
						}
					    
						li_title_el.appendChild(li_value_el);
					}
					
					
					
					li_title_el.classList.add('extension-buttoninput-overview-' + node_name.toLowerCase().replace(/\W/g, ''));
					
					
					
					
					
					
					if(typeof this.persistent_data == 'object' && this.persistent_data != null && typeof this.persistent_data['things'] != 'undefined' && typeof this.persistent_data['things'][nice_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name] != 'undefined'){
						
						//console.warn("button enabled state already exists in persistent data: ", this.persistent_data['things'][nice_name][node_name]);
						
						if(typeof this.persistent_data['things'][nice_name][node_name]['enabled'] == 'boolean' && this.persistent_data['things'][nice_name][node_name]['enabled'] == true){
							li_title_el.classList.add('extension-buttoninput-overview-selected');
						}
						
					}
					
					
					li.appendChild(li_title_el);
					
					
					
					
					li.classList.add('extension-buttoninput-overview-' + node_name.toLowerCase().replace(/\W/g, ''));
				    element.appendChild(li);
					
					
					
					
					
					
				    if (Object.keys(node).length) {
						depth++;
				        var ul = document.createElement('ul');
						ul.classList.add('extension-buttoninput-overview-depth' + depth);
						
						// Also add a range slider so the user can force the button to act as a momentary latch with X states to toggle through
						//if(node_name.toLowerCase() == 'keycode'){
						if(depth == 5){
							//console.log("creating latching slider");
							let latch_container_el = document.createElement('li');
							latch_container_el.classList.add('extension-buttoninput-overview-latching-container');
						
							const maximum_latches = 20;
							
							
							
						
							let latch_value_el = document.createElement('div');
							latch_value_el.classList.add('extension-buttoninput-overview-latching-value');
						
							let latch_input_el = document.createElement('input');
							latch_input_el.setAttribute('type','range');
							latch_input_el.setAttribute('min',0);
							latch_input_el.setAttribute('max',maximum_latches);
							latch_input_el.setAttribute('placeholder','0');
						
							if(typeof this.persistent_data == 'object' && this.persistent_data != null && typeof this.persistent_data['things'] != 'undefined' && typeof this.persistent_data['things'][nice_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name]['latching'] == 'number' && this.persistent_data['things'][nice_name][node_name]['latching'] > 0 && this.persistent_data['things'][nice_name][node_name]['latching'] <= maximum_latches){
								latch_input_el.setAttribute('value', this.persistent_data['things'][nice_name][node_name]['latching']);
								latch_value_el.textContent = this.persistent_data['things'][nice_name][node_name]['latching'];
								ul.classList.add('extension-buttoninput-overview-latching-show-opposite-selector');
							}
							else{
								latch_input_el.setAttribute('value',0);
								latch_value_el.textContent = '0';
							}
						
							latch_input_el.addEventListener('change', () => {
								//console.log("latching range slider was moved to: ", latch_input_el.value);
								//console.log("- nice_name and node_name: ", nice_name, node_name);
							
								latch_value_el.textContent = latch_input_el.value;
							
								if(typeof this.persistent_data['things'] == 'undefined'){
									this.persistent_data['things'] = {};
								}
							
								if(typeof this.persistent_data['things'][nice_name] == 'undefined'){
									this.persistent_data['things'][nice_name] = {};
								}
							
								if(typeof this.persistent_data['things'][nice_name][node_name] == 'undefined'){
									this.persistent_data['things'][nice_name][node_name] = {'enabled':true};
								}
							
								if(typeof this.persistent_data['things'][nice_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name] != 'undefined'){
									this.persistent_data['things'][nice_name][node_name]['latching'] = parseInt(latch_input_el.value);
									this.persistent_data['things'][nice_name][node_name]['latched'] = 0;
									
									if(this.persistent_data['things'][nice_name][node_name]['latching'] > 0){
										ul.classList.add('extension-buttoninput-overview-latching-show-opposite-selector');
									}
									else{
										ul.classList.remove('extension-buttoninput-overview-latching-show-opposite-selector');
									}
									
									if(latch_explanation_container_el){
										latch_explanation_container_el.textContent = generate_explanation(this.persistent_data['things'][nice_name][node_name]);
									}
									
									if(save_button_el){
										save_button_el.style.display = 'block';
									}
								
								}
								else{
									console.error("could not add/update latching counter, somehow the thing and property are not in the persistent data yet.  nice_name, node_name, things: ", nice_name, node_name, this.persistent_data['things']);
								}
							
							});
						
						
						
							latch_container_el.appendChild(latch_input_el);
							latch_container_el.appendChild(latch_value_el);
						
							ul.appendChild(latch_container_el);
							
							
							
							// SET OPPOSITE
							
							if(opposite_dropdown_list && opposite_dropdown_list.length > 1){
								let latch_opposite_container_el = document.createElement('li');
								latch_opposite_container_el.classList.add('extension-buttoninput-overview-latching-opposite-container');
							
							
								let latch_opposite_select_label_el = document.createElement('div');
								latch_opposite_select_label_el.classList.add('extension-buttoninput-overview-latching-opposite-label');
								latch_opposite_select_label_el.textContent = 'Negative opposite button: ';
								
								let latch_opposite_select_el = document.createElement('select');
							
								//latch_opposite_container_el.textContent = JSON.stringify(Object.keys(value.capabilities),null,2);
							
								
								
								
								
							    let default_option_el = document.createElement('option');
							    default_option_el.value = 'None';
							    default_option_el.text = 'None';
								latch_opposite_select_el.appendChild(default_option_el);
								
								for (var i = 0; i < opposite_dropdown_list.length; i++) {
									if(opposite_dropdown_list[i] != node_name){
									    let option_el = document.createElement('option');
									    option_el.value = opposite_dropdown_list[i];
										if(opposite_dropdown_list[i].startsWith('KEY_')){
											option_el.text = opposite_dropdown_list[i].replace('KEY_','');
										}else{
											option_el.text = opposite_dropdown_list[i];
										}
									    latch_opposite_select_el.appendChild(option_el);
									}
								    
								}
								
								if(typeof this.persistent_data['things'] != 'undefined' && typeof this.persistent_data['things'][nice_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name]['opposite'] == 'string'){
									latch_opposite_select_el.value = this.persistent_data['things'][nice_name][node_name]['opposite'];
								}
								
								latch_opposite_select_el.addEventListener('change', () => {
									//console.log("dropdown changed to: ", latch_opposite_select_el.value );
									if(latch_opposite_select_el.value == 'None'){
										if(typeof this.persistent_data['things'][nice_name][node_name]['opposite'] == 'string'){
											delete this.persistent_data['things'][nice_name][node_name]['opposite'];
										}
									}else{
										this.persistent_data['things'][nice_name][node_name]['opposite'] = latch_opposite_select_el.value;
									}
									if(latch_explanation_container_el){
										latch_explanation_container_el.textContent = generate_explanation(this.persistent_data['things'][nice_name][node_name]);
									}
									
									if(save_button_el){
										save_button_el.style.display = 'block';
									}
									
								});
								
								latch_opposite_container_el.appendChild(latch_opposite_select_label_el);
								latch_opposite_container_el.appendChild(latch_opposite_select_el);
							
								ul.appendChild(latch_opposite_container_el);
								
							}
							
							
							
							
							if(typeof this.persistent_data['things'] != 'undefined' && typeof this.persistent_data['things'][nice_name] != 'undefined' && typeof this.persistent_data['things'][nice_name][node_name] != 'undefined' ){
								latch_explanation_container_el.textContent = generate_explanation(this.persistent_data['things'][nice_name][node_name]);
							}
							
							
							ul.appendChild(latch_explanation_container_el);
							
							
						}
						
						
				        li.appendChild(ul);
						
						
						
				        for (var i=0; i < Object.keys(node).length; i++) {
							const key_name = Object.keys(node)[i];
							//console.log("node key_name: ", key_name);
							
							if(key_name == 'last_time' && typeof node[key_name] == 'number'){
								const now_stamp = (Date.now() / 1000);
								
								let seconds_ago = Math.floor(now_stamp - node[key_name])
								
								if(scrolled_into_view == false && node[key_name] > now_stamp - 2){
									//console.log("ACtuALLy NOW PRESSED!: ", node_name);
									scrolled_into_view = true;
									setTimeout(() => {
										//console.log("scrolling li item into view: ", li);
										li.scrollIntoView(true);
									}, 50);
									
								}
								
								
								if(node[key_name] > now_stamp - 5){
									//console.log("NOW PRESSED!: ", node_name);
									li.classList.add('extension-buttoninput-overview-now');
									
								}
								else if(node[key_name] > now_stamp - 10){
									//console.log("RECENTLY PRESSED!: ", node_name);
									li.classList.add('extension-buttoninput-overview-recent');
								}
								else if(seconds_ago < 60){
									//console.log("RECENTLY PRESSED!: ", node_name);
									li.classList.add('extension-buttoninput-overview-old');
								}
								
								
								
								if(seconds_ago < 60){
									//process_tree(key_name, seconds_ago + " seconds ago", ul, depth);
									const li_time_ago_el = document.createElement('span');
									li_time_ago_el.textContent = seconds_ago + " seconds ago";
									li_time_ago_el.classList.add('extension-buttoninput-overview-time-ago');
									
									li_title_el.appendChild(li_time_ago_el);
									
								}
								
							}
							else{
								process_tree(key_name, node[key_name], ul, depth);
							}
							
				            
				        }
				    }
				}
				
				
				if(typeof value.capabilities == 'object' && value.capabilities != null){
					
					let event_list = document.createElement('ul');
					
					process_tree(value.nice_name, value.capabilities, event_list);
					
					overview_el.appendChild(event_list);
					
				}
				
				
				/*
				if(value.input_data.length){
					
					
					let list_el = document.createElement('ul');
					
					for(let x = 0; x < value.input_data.length; x++){
					
						let list_item_el = document.createElement('li');
						list_item_el.textContent = '' + value.input_data[x];
						list_el.appendChild(list_item_el);
					}
				
					overview_el.appendChild(list_el);
				}
				else{
					let no_data_el = document.createElement('p');
					no_data_el.textContent = 'No data';
					overview_el.appendChild(no_data_el);
				}
				*/
				
				
				
				
			}
			
			
			
			
			
		}
		
		
		
	}


  }

  new ButtonInput();
	
})();


