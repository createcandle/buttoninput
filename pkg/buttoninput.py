"""

Button Input addon for Candle Controller / Webthings Gateway.

"""


import os
import sys
# This helps the addon find python libraries it comes with, which are stored in the "lib" folder. The "package.sh" file will download Python libraries that are mentioned in requirements.txt and place them there.
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib')) 

import json
import time

#import evdev
from evdev import InputDevice, categorize, ecodes, list_devices

import asyncio

#import datetime
#import requests  # noqa
#import threading
import subprocess

# This loads the parts of the addon.
from gateway_addon import Database, Adapter, Device, Property, PropertyError, APIHandler, APIResponse


# Not sure what this is used for, but leave it in.
_TIMEOUT = 3

# Not sure what this is used for either, but leave it in.
_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

# Not sure what this is used for either, but leave it in.
if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))



class ButtonInputAdapter(Adapter):
    """Adapter for addon """

    def __init__(self, verbose=False):
        """
        Initialize the object.

        verbose -- whether or not to enable verbose logging
        """
        
        #print("Starting adapter init")

        self.ready = False # set this to True once the init process is complete.
        self.addon_name = 'buttoninput'
        
        
        self.name = self.__class__.__name__ # TODO: is this needed?
        Adapter.__init__(self, self.addon_name, self.addon_name, verbose=verbose)

        # set up some variables
        self.DEBUG = True
        
        self.inputs = [] # holds the evdev event objects
        self.input_data = {} # holds data that can be sent to the front-end
        
        self.rate_limit = 1        
        
        # There is a very useful variable called "user_profile" that has useful values from the controller.
        #print("self.user_profile: " + str(self.user_profile))

        
        # Create some path strings. These point to locations on the drive.
        self.addon_path = os.path.join(self.user_profile['addonsDir'], self.addon_name) # addonsDir points to the directory that holds all the addons (/home/pi/.webthings/addons).
        self.data_path = os.path.join(self.user_profile['dataDir'], self.addon_name)
        self.persistence_file_path = os.path.join(self.data_path, 'persistence.json') # dataDir points to the directory where the addons are allowed to store their data (/home/pi/.webthings/data)
        
        # Create the data directory if it doesn't exist yet
        if not os.path.isdir(self.data_path):
            print("making missing data directory")
            os.mkdir(self.data_path)
        
        #if sys.platform == 'darwin':
        #    print("running on a Mac")
			
		
        self.devices = {}
            
        self.persistent_data = {}
            
        try:
            with open(self.persistence_file_path) as f:
                self.persistent_data = json.load(f)
                if self.DEBUG:
                    print('self.persistent_data was loaded from file: ' + str(self.persistent_data))
                    
        except:
            if self.DEBUG:
                print("Could not load persistent data (if you just installed the add-on then this is normal)")

        
        try:
            self.add_from_config()
        except Exception as ex:
            print("Error loading config: " + str(ex))


        if 'things' not in self.persistent_data:
            self.persistent_data['things'] = {}


        # Start the API handler. This will allow the user interface to connect
        try:
            if self.DEBUG:
                print("starting api handler")
            self.api_handler = ButtonInputAPIHandler(self, verbose=True)
            if self.DEBUG:
                print("Adapter: API handler initiated")
        except Exception as e:
            if self.DEBUG:
                print("Error, failed to start API handler: " + str(e))

        self.save_persistent_data()
        
        self.scan_devices()
        
        self.generate_things()
        
        self.asyncio_loop = asyncio.get_event_loop()
        
        self.asyncio_loop.run_forever()
        
        # The addon is now ready
        self.ready = True 




    def add_from_config(self):
        """ This retrieves the addon settings from the controller """

        try:
            database = Database(self.addon_name)
            if not database.open():
                print("Error. Could not open settings database")
                return

            config = database.load_config()
            database.close()

        except:
            print("Error. Failed to open settings database. Closing proxy.")
            self.close_proxy() # this will purposefully "crash" the addon. It will then we restarted in two seconds, in the hope that the database is no longer locked by then
            return
            
        try:
            if not config:
                print("Warning, no config.")
                return

            # Let's start by setting the user's preference about debugging, so we can use that preference to output extra debugging information
            if 'Debugging' in config:
                self.DEBUG = bool(config['Debugging'])
                if self.DEBUG:
                    print("Debugging enabled")

            if self.DEBUG:
                print(str(config)) # Print the entire config data
                
            #if 'A boolean setting' in config:
            #    self.persistent_data['a_boolean_setting'] = bool(config['A boolean setting']) # sometime you may want the addon settings to override the persistent value
            #    if self.DEBUG:
            #        print("A boolean setting preference was in config: " + str(self.persistent_data['a_boolean_setting']))

            if 'Update frequency' in config:
                self.rate_limit = 1 - (int(config['Update frequency'])) / 100
                if self.DEBUG:
                    print("An Update frequency preference was in config. New self.rate_limit: " + str(self.rate_limit))
            

        except Exception as ex:
            print("Error in add_from_config: " + str(ex))







    def generate_things(self):
        try:
            if self.DEBUG:
                print("DEBUG: in generate_things")
            
            if 'things' in self.persistent_data:
                for nice_name, props in self.persistent_data['things'].items():
                
                    # Create the device object
                    self.devices[nice_name] = ButtonInputDevice(self,nice_name,props)
            
                    # Tell the controller about the new device that was created. This will add the new device to self.devices too
                    self.handle_device_added(self.devices[nice_name])
            
                    if self.DEBUG:
                        print("DEBUG: buttoninput_device created: " + str(nice_name))
                
                    self.devices[nice_name].connected = True
                    self.devices[nice_name].connected_notify(True)

        except Exception as ex:
            if self.DEBUG:
                print("caught error in generate_things: " + str(ex))
            



    #
    #  CHANGING THE PROPERTIES
    #



    def scan_devices(self):
        
        #scan_devices_response = run_command('ls -l /dev/input/event*')
        #print("raw scan_devices_response: " + str(scan_devices_response))
        
        self.inputs = []
        self.input_data = {}
        
        self.inputs = [InputDevice(path) for path in list_devices()]
        
        if self.DEBUG:
            print("scan_devices: len(self.inputs): " + str(len(self.inputs)))
        
        event_index = 0
        for device in self.inputs:
            if self.DEBUG:
                print("")
                print(str(event_index) + ". ")
            
            try:
                
                self.input_data[ str(device.path) ] =  {}
                
                if self.DEBUG:
                    print(device.path, device.name, device.phys)
        
                caps = device.capabilities(verbose=True)
            
                clean_caps = {}
            
                for key, value in caps.items():
                
                    tuple_dict = list(key)
                    clean_caps[ tuple_dict[0] ] = {'keycode':tuple_dict[1],'children':{}}
                
                    for sub_item in value:
                        if 'tuple' in str(type(sub_item)):
                        
                            if 'tuple' in str(type(sub_item[0])):
                            
                                if 'AbsInfo' in str(sub_item):
                                
                                    abs_data = list(sub_item)[0]
                                    abs_details = list(sub_item)[1]._asdict()
                                    abs_details['keycode'] = int(abs_data[1])
                                    clean_caps[ tuple_dict[0] ]['children'][ str(abs_data[0]) ] = abs_details

                                else:
                                    for alt_name in list(sub_item[0]):
                                        clean_caps[ tuple_dict[0] ]['children'][ str(alt_name) ] =  {'keycode':int(list(sub_item)[1])}
                            else:
                                clean_caps[ tuple_dict[0] ]['children'][ str(list(sub_item)[0]) ] = {'keycode':int(list(sub_item)[1])}
                        
                        else:
                            if self.DEBUG:
                                print("sub-item was not a tuple?: ", type(sub_item))

                
        
                #print("")
                #print(device.capabilities(verbose=True))
                #print("->->")
                #print(json.dumps(clean_caps, indent=4))
        
        
                self.input_data[ str(device.path) ] = {'index':event_index, 'has_buttons':False, 'input_data':[], 'path':str(device.path), 'nice_name':'buttoninput_' + str(device.name).replace(' ','_'), 'phys': str(device.phys) ,'capabilities': clean_caps ,'capabilities_raw': str(device.capabilities(verbose=False))}
        
                asyncio.ensure_future(self.print_events(device))
            
                
                
            except Exception as ex:
                if self.DEBUG:
                    print("caught ERROR looping over input events: " + str(ex))
            
            event_index += 1
        
        return
        
            
         
    async def print_events(self,device):
        try:
            async for event in device.async_read_loop():
                
                event_category = str(categorize(event))
            
                #print("event_category: " + str(event_category))
                
                if not device.path in self.input_data:
                    if self.DEBUG:
                        print("ERROR, device path not in self.input_data: " + str(device.path))
                
                #if event.type == ecodes.EV_KEY:
               #     print("detected a key press")
                
            
                if event_category.startswith('synchronization event'):
                    #print("skipping synchronization event")
                    continue
            
                #elif event_category.startswith('absolute axis event'):
                    #print("skipping absolute axis event")
                    
                    
                    #if self.input_data[device.path]['has_buttons'] == True:
                        
                        #print("_OK_" , device.path, categorize(event), event, sep=': ')
                        
                        #print("VAL! " + str(event.value))
                        
                        #pass
                                
                    #continue
                
                #elif event_category.startswith('event'):

                    
                    #if self.input_data[device.path]['has_buttons'] == True:
                    #    print("X" , device.path, categorize(event), event, sep=': ')
                    
                    #else:
                    #    continue
                
                
                
                
                if event.type == ecodes.EV_KEY or event_category.startswith('key event') or (event_category.startswith('absolute axis event') and self.input_data[device.path]['has_buttons'] == True):
                    
                    #print(device.path, categorize(event), sep=': ')
                    #print("event: " + str(event))
                    #print("categorize(event): " + str(categorize(event)))
            
                    self.input_data[device.path]['has_buttons'] = True
                    
                    #print("event_category: " + str(event_category))
                    
                    if 'capabilities' in self.input_data[device.path]:
                        
                        if event_category.startswith('absolute axis event') and 'ABS_' in str(event_category):
                            abs_code = 'ABS_' + str(event_category.split('ABS_')[1])
                            #print("abs_code: " + str(abs_code))
                        
                    
                            if 'EV_ABS' in self.input_data[device.path]['capabilities'] and 'children' in self.input_data[device.path]['capabilities']['EV_ABS'] and abs_code in self.input_data[device.path]['capabilities']['EV_ABS']['children']:
                                #print("BINGO, found abs_code in capabilities: " + str(abs_code))
                            
                                if 'last_time' in self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code]:
                                    if (self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code]['last_time'] < time.time() - self.rate_limit) or ('max' in self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code].keys() and self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code]['max'] == 1):
                                        self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code]['last_time'] = time.time()
                                        
                                        #print(device.path, categorize(event), sep=': ')
                                        #print("event: " + str(event))
                                        
                                        if 'nice_name' in self.input_data[device.path]: # and self.input_data[device.path]['nice_name'] in self.devices.keys():
                                            
                                            #print("thing mismatch? ", device.path, str(self.input_data[device.path]['nice_name']))
                                            
                                            thingy = self.get_device(str(self.input_data[device.path]['nice_name']))
                                            #print("thingy: ", thingy)
                                            
                                            if thingy:
                                                
                                                #properties_dict = thingy.get_property_descriptions()
                                                #print("in this properties_dict: ", properties_dict.keys())
                                                #print("V: " + str(event.value))
                                                
                                                propy = thingy.find_property(abs_code)
                                                if propy:
                                                    #print("found ABS property too")
                                                    if propy.set_cached_value_and_notify(int(event.value)):
                                                        pass
                                                        #print("OK, value set to: " + str(event.value))
                                                    else:
                                                        pass
                                                        #print("FAILED TO SET ABS VALUE: " + str(event.value))
                                                #else:
                                                #    print("DID NOT FIND ABS PROP IN THING: ", abs_code)
                                                    
                                                
                                                 
                                    #else:
                                    #    print("   too soon for: " + str(abs_code))       
                                            
                                else:
                                    self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code]['last_time'] = time.time()
                                
                                self.input_data[device.path]['capabilities']['EV_ABS']['children'][abs_code]['value'] = int(event.value)
                                
                                
                        
                        elif event_category.startswith('key event') and 'EV_KEY' in self.input_data[device.path]['capabilities']:
                            
                            key_code = str(event_category.split(', ')[1])
                            #print("initial button keycode: " + str(key_code))
                            
                            short_code_detail = ''
                            
                            if '(' in key_code:
                                
                                if '((' in key_code:
                                    number_code = int(key_code.split('((')[0])
                                    short_code = key_code.split('((')[1]
                                    #short_code = key_code.split('))')[0]
                                    short_code_detail = event_category.split('))')[1]
                                    
                                    if "," in short_code:
                                        short_code = short_code.split(",")[0]
                                    
                                    
                                else:
                                    number_code = key_code.split('(')[0]
                                    key_code = key_code.split('(')[1]
                                    if ')' in key_code:
                                        short_code = key_code.split(')')[0]
                                        short_code_detail = key_code.split(')')[1]
                                
                                short_code = short_code.replace("'","")
                                short_code = short_code.strip()
                                short_code_detail = short_code_detail.replace(',','')
                                short_code_detail = short_code_detail.strip()
                                
                                    #short_code = short_code.replace('KEY_','')
                                    #short_code = short_code.replace('BTN_','')
                                
                                #print("button short_code: " + str(short_code))
                                #print("button short_code_detail: " + str(short_code_detail))
                        
                                if 'children' in self.input_data[device.path]['capabilities']['EV_KEY'] and short_code in self.input_data[device.path]['capabilities']['EV_KEY']['children']:
                                    #print("found button short_code in capabilities: ", short_code)
                            
                                    self.input_data[device.path]['capabilities']['EV_KEY']['children'][short_code]['last_time'] = int(event.sec)
                                    
                                    if not 'children' in self.input_data[device.path]['capabilities']['EV_KEY']['children'][short_code]:
                                        self.input_data[device.path]['capabilities']['EV_KEY']['children'][short_code]['children'] = {}
                                    if not short_code_detail in self.input_data[device.path]['capabilities']['EV_KEY']['children'][short_code]['children']:
                                        self.input_data[device.path]['capabilities']['EV_KEY']['children'][short_code]['children'][short_code_detail] = {'keycode':int(number_code)}
                                    self.input_data[device.path]['capabilities']['EV_KEY']['children'][short_code]['children'][short_code_detail]['last_time'] = int(event.sec)
                                    
                                    thingy = self.get_device(str(self.input_data[device.path]['nice_name']))
                                    #print("button thingy: ", thingy)
                                    
                                    #properties_dict = thingy.get_property_descriptions()
                                    #print("button properties_dict: ", properties_dict)
                                    #print("button short_code: ", short_code)
                                    
                                    propy = thingy.find_property(short_code)
                                    if propy:
                                        #print("found button short_code property too")
                                        if propy.set_cached_value_and_notify(bool(event.value)):
                                            #print("OK, button value set")
                                            pass
                                        else:
                                            #print("FAILED TO SET BUTTON VALUE")
                                            pass
                            
                                
                                #try:
                                #    self.devices[ str(self.input_data[device.path]['nice_name']) ].get_props()[short_code].update(bool(event.value)   
                                #except Exception as ex:
                                #    print("caught error in trying to go around thing update issue: " + str(ex))
                                
                            
                            #else:
                            #    print("ERROR, no brackets in button keycode string?")                
                        
                    
                            
                            
        except Exception as ex:
            if self.DEBUG:
                print("caught error in print_events: " + str(ex))
 
 
 
        

    def unload(self):
        """ Happens when the user addon / system is shut down."""
        if self.DEBUG:
            print("Unloading ButtonInput addon")
            
        
        # A final chance to save the data.
        self.save_persistent_data()
        
        try:
            for thing in self.devices:
                self.devices[thing].connected_notify(False)
        except Exception as ex:
            if self.DEBUG:
                print("Error setting status on thing: " + str(ex))
        
        try:
            self.asyncio_loop.close()
        except Exception as ex:
            if self.DEBUG:
                print("caught error closing event loop: " + str(ex))


    def remove_thing(self, device_id):
        """ Happens when the user deletes the thing."""
        if self.DEBUG:
            print("user requested deleting the thing with device_id: ", device_id)
        try:
            # We don't have to delete the thing in the addon, but we can.
            obj = self.get_device(device_id)
            self.handle_device_removed(obj) # Remove from device dictionary
            if self.DEBUG:
                print("User removed thing")
                
            # TODO also remove from self.devices
                
        except Exception as ex:
            if self.DEBUG:
                print("Could not remove thing from devices: " + str(ex))



    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store")

        try:
            if not os.path.isfile(self.persistence_file_path):
                open(self.persistence_file_path, 'a').close()
                if self.DEBUG:
                    print("Created an empty persistence file")
            else:
                if self.DEBUG:
                    print("Persistence file existed. Will try to save to it.")

            with open(self.persistence_file_path) as f:
                if self.DEBUG:
                    print("DEBUG: saving: " + str(self.persistent_data))
                try:
                    json.dump( self.persistent_data, open( self.persistence_file_path, 'w+' ) )
                except Exception as ex:
                    print("Error saving to persistence file: " + str(ex))
                return True
            #self.previous_persistent_data = self.persistent_data.copy()

        except Exception as ex:
            if self.DEBUG:
                print("Error: could not store data in persistent store: " + str(ex) )
        
        return False






class ButtonInputDevice(Device):
    """Button Input device type."""

    def __init__(self, adapter,nice_name,props):

        Device.__init__(self, adapter, nice_name)

        self._id = nice_name
        self.id = nice_name
        self.adapter = adapter
        self.DEBUG = adapter.DEBUG

        self.name = nice_name #.replace('buttoninput_','').replace('_',' ')
        self.title = nice_name.replace('buttoninput_','').replace('_',' ')
        self.description = 'A connected human input device'
        
        
        on_off_property_set = False
        
        # self._type = ['MultiLevelSwitch'] # a combination of a toggle switch and a numeric value

        try:
            
            for prop_key, prop_details in props.items():
                if self.DEBUG:
                    print("DEBUG: adding property.  prop_key: " + str(prop_key))
            
                clean_prop_name = prop_key.replace('BTN_','').replace('KEY_','').replace('ABS_','').replace('REL_','')
            
                if 'min' in prop_details:
                    self.properties[prop_key] = ButtonInputProperty(
                                    self,
                                    prop_key,
                                    {
                                        #'@type': 'OnOffProperty', # by giving the property this "capability", it will create a special icon indicating what it can do. Note that it's a string (while on the device it's an array).
                                        'title': clean_prop_name,
                                        'readOnly': True,
                                        'type': 'integer',
                                        'minimum': int(prop_details['min']),
                                        'maximum': int(prop_details['max']),
                                    },
                                    int(prop_details['min']) 
                                    )
                                    #random.randint(int(prop_details['min']), int(prop_details['max'])) )
                
                else:
                    
                    desc = {
                                #'@type': 'OnOffProperty', # by giving the property this "capability", it will create a special icon indicating what it can do. Note that it's a string (while on the device it's an array).
                                'title': clean_prop_name,
                                'readOnly': True,
                                'type': 'boolean'
                            }
                    
                    if on_off_property_set == False:
                        on_off_property_set = True
                        desc['@type'] = 'PushedProperty'
                        #self['@type'] = 'PushButton'
                        self._type = ['PushButton']
                            
                    
                    self.properties[prop_key] = ButtonInputProperty(
                                    self,
                                    prop_key,
                                    desc,
                                    False)
                
                
            

        except Exception as ex:
            if self.DEBUG:
                print("error adding properties to thing: " + str(ex))


    def get_props(self):
        return self.properties




class ButtonInputProperty(Property):

    def __init__(self, device, name, description, value):
        
        Property.__init__(self, device, name, description)
        
        self.device = device
        self.DEBUG = device.DEBUG
        
        clean_name = name.replace('BTN_','').replace('KEY_','').replace('ABS_','').replace('REL_','')
        #print("property clean_name: " + str(clean_name))
        # you could go up a few levels to get values from the adapter:
        # print("debugging? " + str( self.device.adapter.DEBUG ))
        
        # TODO: set the ID properly?
        self._id = name
        self.id = name
        #self.name = clean_name # TODO: is name still used?
        self.title = clean_name # TODO: the title isn't really being set?
        self.description = description # a dictionary that holds the details about the property type
        
        self.type = 'integer'
        if 'type' in self.description:
            self.type = self.description['type']
        
        if self.type == 'boolean':
            self.value = bool(value)
        else:
            self.value = value # the value of the property
        
        
        # Notifies the controller that this property has a (initial) value
        #self.set_cached_value(value)
        #self.device.notify_property_changed(self)
        
        
        self.set_cached_value_and_notify(value)
        
        if self.DEBUG:
            print("DEBUG: property: initiated: " + str(self.id) + " (" + str(self.title) + "), of type: " +  str(self.type) + ", with value: " + str(value))

    def set_cached_value_and_notify(self, value):
        old_value = self.value
        self.set_cached_value(value)

        # set_cached_value may change the value, therefore we have to check
        # self.value after the call to set_cached_value
        has_changed = old_value != self.value

        if has_changed:
            self.device.notify_property_changed(self)

        return has_changed

    def set_cached_value(self, value):
        if 'type' in self.description and \
                self.description['type'] == 'boolean':
            self.value = bool(value)
        else:
            self.value = value

        return self.value

    def get_value(self):
        return self.value

    def set_value(self, value):
        if 'readOnly' in self.description and self.description['readOnly']:
            raise PropertyError('Read-only property')

        if 'minimum' in self.description and \
                value < self.description['minimum']:
            raise PropertyError('Value less than minimum: {}'
                                .format(self.description['minimum']))

        if 'maximum' in self.description and \
                value > self.description['maximum']:
            raise PropertyError('Value greater than maximum: {}'
                                .format(self.description['maximum']))

        if 'multipleOf' in self.description:
            # note that we don't use the modulus operator here because it's
            # unreliable for floating point numbers
            multiple_of = self.description['multipleOf']
            if value / multiple_of - round(value / multiple_of) != 0:
                raise PropertyError('Value is not a multiple of: {}'
                                    .format(multiple_of))

        if 'enum' in self.description and \
                len(self.description['enum']) > 0 and \
                value not in self.description['enum']:
            raise PropertyError('Invalid enum value')

        self.set_cached_value_and_notify(value)

        
    def update(self, value):
        if self.type == 'boolean' or self.type == 'bool':
            value = bool(value)

        #print("property: update. value: " + str(value) + " (old value: " + str(self.value) + ")")
        
        if value != self.value:
            self.value = value
            self.set_cached_value(value)
            self.device.notify_property_changed(self)

        





class ButtonInputAPIHandler(APIHandler):
    """API handler."""

    def __init__(self, adapter, verbose=False):        
        self.adapter = adapter
        self.DEBUG = self.adapter.DEBUG

        try:
            APIHandler.__init__(self, self.adapter.addon_name)
            self.manager_proxy.add_api_handler(self) 
            
        except Exception as e:
            print("Error: failed to init API handler: " + str(e))
        
        
    #
    #  HANDLE REQUEST
    #

    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                return APIResponse(status=404) # we only accept POST requests
            
            if request.path == '/ajax': # you could have all kinds of paths. In this example we only use this one, and use the 'action' variable to denote what we want to api handler to do

                try:
                    
                    
                    action = str(request.body['action']) 
                    
                    
                    # INIT
                    if action == 'init':
                        if self.DEBUG:
                            print("API: in init")
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({
                                      'a_number_setting':self.adapter.a_number_setting,
                                      'thing_state' : self.adapter.persistent_data['state'],
                                      'slider_value':self.adapter.persistent_data['slider'],
                                      'items_list':self.adapter.items_list,
                                      'debug': self.adapter.DEBUG
                                      }),
                        )
                        
                    
                    
                    # GET INPUT_DATA
                    elif action == 'get_input_data':
                        if self.DEBUG:
                            print("API: in get_input_data")
                        
                        state = True
                        
                        
                        #try:
                            #asyncio.ensure_future(self.adapter.update_input_data())
                            #if self.adapter.asyncio_loop:
                            #    self.adapter.asyncio_loop.run_until_complete(self.adapter.update_input_data())
                            #    state = True
                            #    print("update done")
                        #except Exception as ex:
                        #    print("caught error calling update_input_data: " + str(ex))    
                        
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state':state, 'input_data':self.adapter.input_data,'persistent_data':self.adapter.persistent_data}),
                        )
                    
                    
                    
                    
                    # SAVE PERSISTENT DATA
                    elif action == 'save_persistent_data':
                        if self.DEBUG:
                            print("API: in save_persistent_data")
                        
                        
                        state = False
                        
                        if 'persistent_data' in request.body:
                            try:
                                self.adapter.persistent_data = request.body['persistent_data']
                                self.adapter.save_persistent_data()
                                self.adapter.generate_things()
                                self.send_pairing_prompt("Button things created/updated")
                            
                                state = True
                                
                            except Exception as ex:
                                if self.DEBUG:
                                    print("caught an error in API called to save_persistant_data: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state':state, 'input_data':self.adapter.input_data,'persistent_data':self.adapter.persistent_data}),
                        )
                    
                    
                    
                    
                    # RESCAN
                    elif action == 'rescan':
                        if self.DEBUG:
                            print("API: in rescan")
                        state = False
                        
                        try:
                            self.adapter.scan_devices()
                            state = True
                        except Exception as ex:
                            if self.DEBUG:
                                print("caught error calling scan_devices: " + str(ex))
                            
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state':state, 'input_data':self.adapter.input_data, 'persistent_data':self.adapter.persistent_data}),
                        )
                    
                    
                    
                    
                    
                    
                    else:
                        if self.DEBUG:
                            print("Error, that action is not possible")
                        return APIResponse(
                            status=404
                        )
                        
                        
                    
                        
                        
                except Exception as ex:
                    if self.DEBUG:
                        print("Ajax error: " + str(ex))
                    return APIResponse(
                        status=500,
                        content_type='application/json',
                        content=json.dumps({"error":"Error in API handler"}),
                    )
                    
            else:
                if self.DEBUG:
                    print("invalid path: " + str(request.path))
                return APIResponse(status=404)
                
        except Exception as e:
            if self.DEBUG:
                print("Failed to handle UX extension API request: " + str(e))
            return APIResponse(
                status=500,
                content_type='application/json',
                content=json.dumps({"error":"General API error"}),
            )
        


