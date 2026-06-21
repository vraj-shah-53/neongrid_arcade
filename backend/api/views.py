import random
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.contrib.auth.models import User
from .models import UserProfile, GameChallenge, OnlineRoom

# ----------------------------------------------------
# 1. TIC-TAC-TOE MINIMAX AI
# ----------------------------------------------------
def check_winner(board):
    win_patterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], # Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], # Columns
        [0, 4, 8], [2, 4, 6]             # Diagonals
    ]
    for p in win_patterns:
        if board[p[0]] and board[p[0]] == board[p[1]] == board[p[2]]:
            return board[p[0]]
    if None not in board and "" not in board:
        return "Tie"
    return None

def minimax(board, depth, is_maximizing, ai_player, human_player):
    winner = check_winner(board)
    if winner == ai_player:
        return 10 - depth
    if winner == human_player:
        return depth - 10
    if winner == "Tie":
        return 0

    if is_maximizing:
        best_score = -float('inf')
        for i in range(9):
            if board[i] is None or board[i] == "":
                board[i] = ai_player
                score = minimax(board, depth + 1, False, ai_player, human_player)
                board[i] = None
                best_score = max(score, best_score)
        return best_score
    else:
        best_score = float('inf')
        for i in range(9):
            if board[i] is None or board[i] == "":
                board[i] = human_player
                score = minimax(board, depth + 1, True, ai_player, human_player)
                board[i] = None
                best_score = min(score, best_score)
        return best_score

@csrf_exempt
@require_POST
def tictactoe_move(request):
    try:
        data = json.loads(request.body)
        board = data.get('board') # array of size 9
        ai_player = data.get('ai_player', 'O')
        human_player = data.get('human_player', 'X')
        
        # Clean board (replace empty strings with None)
        board = [x if x in ['X', 'O'] else None for x in board]
        
        available_moves = [i for i in range(9) if board[i] is None]
        if not available_moves:
            return JsonResponse({"move": None})
            
        # Introduce a 35% chance of making a random/sub-optimal move
        if random.random() < 0.35:
            best_move = random.choice(available_moves)
        else:
            best_score = -float('inf')
            best_move = None
            
            for i in range(9):
                if board[i] is None:
                    board[i] = ai_player
                    score = minimax(board, 0, False, ai_player, human_player)
                    board[i] = None
                    if score > best_score:
                        best_score = score
                        best_move = i
                        
        return JsonResponse({"move": best_move})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

# ----------------------------------------------------
# 2. SCRIBBLES DRAWING PROMPTS
# ----------------------------------------------------
PROMPTS = [
    # Space
    {"word": "Rocket Ship", "category": "Space", "hint": "A vehicle used to travel to outer space."},
    {"word": "flying saucer", "category": "Space", "hint": "An alien spacecraft shaped like a disc."},
    {"word": "Astronaut", "category": "Space", "hint": "A person trained to travel in a spacecraft."},
    {"word": "Space Station", "category": "Space", "hint": "A large artificial satellite used as a long-term base for manned operations in space."},
    {"word": "Solar System", "category": "Space", "hint": "The collection of eight planets and their moons in orbit round the sun."},
    {"word": "Black Hole", "category": "Space", "hint": "A region of space having a gravitational field so intense that no matter or radiation can escape."},
    {"word": "Telescope", "category": "Space", "hint": "An optical instrument designed to make distant objects appear nearer."},
    {"word": "Comet", "category": "Space", "hint": "A celestial object consisting of a nucleus of ice and dust and, when near the sun, a tail of gas and dust particles pointing away from the sun."},
    {"word": "Meteor Shower", "category": "Space", "hint": "A number of meteors that appear to radiate from one point in the night sky."},
    {"word": "Alien Planet", "category": "Space", "hint": "A planet orbiting a star other than our Sun, possibly hosting extra-terrestrial life."},
    
    # Animals
    {"word": "Dancing Cat", "category": "Animals", "hint": "A feline moving its paws to the rhythm."},
    {"word": "Golden Retriever", "category": "Animals", "hint": "A popular breed of dog known for its friendly nature and golden coat."},
    {"word": "Giraffe", "category": "Animals", "hint": "A large African mammal with a very long neck and forelegs."},
    {"word": "Elephant", "category": "Animals", "hint": "A very large plant-eating mammal with a prehensile trunk, long curved ivory tusks, and large ears."},
    {"word": "Lion", "category": "Animals", "hint": "A large tawny-coloured cat that lives in prides and is known as the king of the jungle."},
    {"word": "Dolphin", "category": "Animals", "hint": "A small gregarious toothed whale that typically has a beaklike snout and is highly intelligent."},
    {"word": "Penguin", "category": "Animals", "hint": "A large flightless seabird of southern seas, with wings shaped like flippers for swimming."},
    {"word": "Kangaroo", "category": "Animals", "hint": "A large plant-eating marsupial with a long powerful tail and strongly developed hindlegs for jumping."},
    {"word": "Octopus", "category": "Animals", "hint": "A sea animal with a soft body and eight long arms."},
    {"word": "Chameleon", "category": "Animals", "hint": "A small slow-moving Old World lizard with a prehensile tail and the ability to change color."},
    {"word": "Shark", "category": "Animals", "hint": "A large predatory fish with a cartilaginous skeleton, multiple rows of teeth, and a prominent dorsal fin."},
    {"word": "Owl", "category": "Animals", "hint": "A nocturnal bird of prey with large forward-facing eyes and a silent flight."},

    # Technology & Gaming
    {"word": "VR Headset", "category": "Technology", "hint": "Goggles used to experience virtual worlds."},
    {"word": "Retro Arcade", "category": "Gaming", "hint": "A gaming cabinet with a joystick and buttons."},
    {"word": "Laptop Computer", "category": "Technology", "hint": "A portable personal computer suitable for mobile use."},
    {"word": "Smartphone", "category": "Technology", "hint": "A mobile phone that performs many of the functions of a computer."},
    {"word": "Smartwatch", "category": "Technology", "hint": "A mobile device worn on the wrist with interactive features."},
    {"word": "Drone", "category": "Technology", "hint": "An unmanned aerial vehicle operated by remote control."},
    {"word": "Game Controller", "category": "Gaming", "hint": "An input device used to control video games."},
    {"word": "Motherboard", "category": "Technology", "hint": "A printed circuit board containing the principal components of a computer."},
    {"word": "Robot Dog", "category": "Technology", "hint": "A mechanical quadruped robot that mimics a canine companion."},
    {"word": "floppy disk", "category": "Technology", "hint": "An old magnetic storage medium used for saving computer data."},
    {"word": "Virtual Reality", "category": "Technology", "hint": "Computer-generated simulation of a three-dimensional image or environment."},
    {"word": "Gaming Keyboard", "category": "Gaming", "hint": "A keyboard specially designed for gaming, often with mechanical switches and RGB lighting."},

    # Sci-Fi & Fantasy
    {"word": "Cyberpunk Car", "category": "Sci-Fi", "hint": "A futuristic car with neon lights."},
    {"word": "haunted house", "category": "Fantasy", "hint": "A spooky old mansion with ghosts."},
    {"word": "Time Machine", "category": "Sci-Fi", "hint": "A hypothetical apparatus for transporting people or objects into the past or future."},
    {"word": "Laser Sword", "category": "Sci-Fi", "hint": "An energy weapon used in futuristic combat, resembling a sword made of light."},
    {"word": "Flying City", "category": "Fantasy", "hint": "A city that floats in the sky using magic or advanced technology."},
    {"word": "Fire Dragon", "category": "Fantasy", "hint": "A legendary monster, like a giant reptile, that breathes fire."},
    {"word": "Wizard Hat", "category": "Fantasy", "hint": "A pointed hat worn by magic practitioners."},
    {"word": "Mermaid", "category": "Fantasy", "hint": "A legendary water-dwelling creature with the head and upper body of a woman and the tail of a fish."},
    {"word": "Magic Wand", "category": "Fantasy", "hint": "A thin rod used to cast spells or perform magic tricks."},
    {"word": "Unicorn", "category": "Fantasy", "hint": "A mythical animal typically represented as a horse with a single straight horn projecting from its forehead."},
    {"word": "Pegasus", "category": "Fantasy", "hint": "A mythical winged horse."},
    {"word": "Portal Gun", "category": "Sci-Fi", "hint": "A device that creates interconnected wormholes on flat surfaces."},

    # Food & Drink
    {"word": "slice of pizza", "category": "Food", "hint": "Triangular food item with cheese and pepperoni."},
    {"word": "coffee mug", "category": "Objects", "hint": "A ceramic container with a hot beverage."},
    {"word": "Ice Cream Cone", "category": "Food", "hint": "A wafer cone holding scoops of frozen dessert."},
    {"word": "Hamburger", "category": "Food", "hint": "A round patty of ground beef, fried or grilled, served in a bun."},
    {"word": "Sushi Roll", "category": "Food", "hint": "A Japanese dish consisting of small balls or rolls of vinegar-seasoned cold rice served with a garnish."},
    {"word": "Birthday Cake", "category": "Food", "hint": "A sweet baked food decorated with candles for a celebration."},
    {"word": "Hot Dog", "category": "Food", "hint": "A cooked sausage in a long split roll."},
    {"word": "Donut", "category": "Food", "hint": "A small fried cake of sweetened dough, typically ring-shaped."},
    {"word": "Pineapple", "category": "Food", "hint": "A large tropical fruit with a spiky tough skin and sweet yellow flesh."},
    {"word": "French Fries", "category": "Food", "hint": "Potatoes cut into strips and deep-fried."},
    {"word": "Chocolate Bar", "category": "Food", "hint": "A rectangular block of sweet dark brown food made from roasted cacao seeds."},
    {"word": "Taco", "category": "Food", "hint": "A Mexican dish consisting of a folded tortilla filled with seasoned meat, cheese, and vegetables."},

    # Landmarks & Places
    {"word": "golden gate bridge", "category": "Landmarks", "hint": "A famous suspension bridge in San Francisco."},
    {"word": "Eiffel Tower", "category": "Landmarks", "hint": "A famous iron lattice tower in Paris, France."},
    {"word": "Egyptian Pyramid", "category": "Landmarks", "hint": "A monumental structure with a square base and sloping sides that meet in a point at the top."},
    {"word": "Statue of Liberty", "category": "Landmarks", "hint": "A colossal neoclassical sculpture on Liberty Island in New York Harbor."},
    {"word": "Colosseum", "category": "Landmarks", "hint": "A giant stone amphitheatre in Rome built by the ancient Romans."},
    {"word": "Great Wall of China", "category": "Landmarks", "hint": "An ancient series of defensive walls built across the historical northern borders of China."},
    {"word": "Big Ben", "category": "Landmarks", "hint": "The nickname for the Great Bell of the striking clock at the north end of the Palace of Westminster in London."},
    {"word": "Taj Mahal", "category": "Landmarks", "hint": "An ivory-white marble mausoleum on the south bank of the Yamuna river in Agra, India."},
    {"word": "Lighthouse", "category": "Landmarks", "hint": "A tower with a bright light at the top, located near the coast to guide ships."},
    {"word": "Windmill", "category": "Landmarks", "hint": "A building with sails that spin in the wind, traditionally used for grinding corn or pumping water."},
    {"word": "Mount Everest", "category": "Landmarks", "hint": "Earth's highest mountain above sea level, located in the Himalayas."},

    # Nature & Places
    {"word": "campfire", "category": "Nature", "hint": "Logs burning outdoors under a starry night."},
    {"word": "Waterfall", "category": "Nature", "hint": "A cascade of water falling from a height, formed when a river or stream flows over a precipice."},
    {"word": "Volcano", "category": "Nature", "hint": "A mountain or hill, typically conical, having a crater or vent through which lava and gas are erupted."},
    {"word": "Desert Oasis", "category": "Nature", "hint": "A fertile spot in a desert where water is found."},
    {"word": "Tropical Island", "category": "Nature", "hint": "A piece of land surrounded by water, with sandy beaches and palm trees."},
    {"word": "Rainbow", "category": "Nature", "hint": "An arch of colors visible in the sky, caused by the refraction of the sun's light in raindrops."},
    {"word": "Snowy Mountain", "category": "Nature", "hint": "A high peak covered in snow and ice."},
    {"word": "Forest Path", "category": "Nature", "hint": "A trail walking through a dense growth of trees and plants."},
    {"word": "Canyon", "category": "Nature", "hint": "A deep gorge, typically one with a river flowing through it."},
    {"word": "Coral Reef", "category": "Nature", "hint": "An underwater ecosystem characterized by reef-building corals."},
    {"word": "Thunderstorm", "category": "Nature", "hint": "A storm with thunder and lightning and typically also heavy rain or hail."},
    {"word": "Autumn Tree", "category": "Nature", "hint": "A tree with orange, red, and yellow leaves falling off."},

    # Objects
    {"word": "electric guitar", "category": "Music", "hint": "A string instrument plugged into an amplifier."},
    {"word": "Treasure Chest", "category": "Objects", "hint": "A large strong box used for storing gold, jewels, or other valuables."},
    {"word": "Wristwatch", "category": "Objects", "hint": "A small clock worn on a strap around the wrist."},
    {"word": "Umbrella", "category": "Objects", "hint": "A folding canopy supported by wooden or metal ribs that protect against rain."},
    {"word": "Microscope", "category": "Objects", "hint": "An optical instrument used for viewing very small objects."},
    {"word": "Magnifying Glass", "category": "Objects", "hint": "A lens that produces an enlarged image of an object."},
    {"word": "Compass", "category": "Objects", "hint": "An instrument containing a magnetized pointer which shows the direction of magnetic north."},
    {"word": "Light Bulb", "category": "Objects", "hint": "A glass bulb inserted into a lamp, which provides light when electrical current passes through."},
    {"word": "Binoculars", "category": "Objects", "hint": "An optical instrument with a lens for each eye, used for viewing distant objects."},
    {"word": "Alarm Clock", "category": "Objects", "hint": "A clock that can be set to make a loud noise at a particular time to wake a person up."},
    {"word": "Bicycle", "category": "Objects", "hint": "A vehicle consisting of two wheels held in a frame one behind the other, propelled by pedals."},
    {"word": "Hourglass", "category": "Objects", "hint": "An invertible device with two connected glass bulbs containing sand that takes an hour to pass from the upper to the lower."},

    # Sports & Adventure
    {"word": "scuba diver", "category": "Adventure", "hint": "A person exploring underwater with oxygen gear."},
    {"word": "Skateboard", "category": "Sports", "hint": "A short narrow board with two small wheels at each end, on which a person stands and moves."},
    {"word": "Basketball Hoop", "category": "Sports", "hint": "A horizontal circular metal rim with a net hanging from it, used in basketball."},
    {"word": "Soccer Ball", "category": "Sports", "hint": "A round black-and-white ball used in the game of football."},
    {"word": "Baseball Bat", "category": "Sports", "hint": "A smooth wooden or metal club used in the sport of baseball to hit the ball."},
    {"word": "Hot Air Balloon", "category": "Adventure", "hint": "A large balloon filled with hot air, carrying a basket for passengers."},
    {"word": "Parachute", "category": "Adventure", "hint": "A cloth canopy which fills with air and allows a person or heavy object to descend slowly when dropped from an aircraft."},
    {"word": "Kayaking", "category": "Adventure", "hint": "Using a kayak to travel across water, typically a river or lake."},
    {"word": "Rock Climbing", "category": "Adventure", "hint": "The sport or activity of climbing rock faces, especially with the aid of ropes and special equipment."},
    {"word": "Surfboard", "category": "Sports", "hint": "A long, narrow board on which a person stands while surfing."},
    {"word": "Archery Bow", "category": "Sports", "hint": "A weapon or sport tool made of a strip of flexible material for shooting arrows."},
    {"word": "Bowling Pin", "category": "Sports", "hint": "One of ten target pins set up in a triangle at the end of a bowling lane."},

    # Music & Arts
    {"word": "Piano Keyboard", "category": "Music", "hint": "A musical instrument played by means of a keyboard, producing sounds via hammers striking strings."},
    {"word": "Violin", "category": "Music", "hint": "A wooden stringed instrument of treble pitch, played with a bow."},
    {"word": "Drums Set", "category": "Music", "hint": "A collection of drums, cymbals, and other percussion instruments."},
    {"word": "Microphone", "category": "Music", "hint": "An instrument for converting sound waves into electrical energy variations, which may then be amplified."},
    {"word": "Headphones", "category": "Music", "hint": "A pair of small speakers worn on or over the head to listen to audio privately."},
    {"word": "Gramophone", "category": "Music", "hint": "An old-fashioned record player using a flat disc and a horn."},
    {"word": "Saxophone", "category": "Music", "hint": "A member of a family of metal wind instruments with a reed, used in jazz and classical music."},
    {"word": "Paint Palette", "category": "Arts", "hint": "A thin board or slab on which an artist lays and mixes colors."},
    {"word": "Camera Film", "category": "Arts", "hint": "A strip of plastic coated with light-sensitive emulsion, used in cameras to record images."},
    {"word": "Theater Mask", "category": "Arts", "hint": "Comedy and tragedy masks used to represent drama in theater."},
    {"word": "Harp", "category": "Music", "hint": "A large, triangular stringed instrument played by plucking strings with the fingers."},
    {"word": "Trumpet", "category": "Music", "hint": "A brass musical instrument with a flared bell and three buttons."}
]

TRIVIA_QUESTIONS = [
    {'question': 'Which is the longest river that flows entirely within India?', 'choices': ['Ganga', 'Godavari', 'Yamuna', 'Narmada'], 'answer': 'Ganga'},
    {'question': 'What is the capital city of India?', 'choices': ['Mumbai', 'Kolkata', 'New Delhi', 'Chennai'], 'answer': 'New Delhi'},
    {'question': "Which Indian city is famously known as the 'Pink City'?", 'choices': ['Jodhpur', 'Jaipur', 'Udaipur', 'Bikaner'], 'answer': 'Jaipur'},
    {'question': 'Which is the smallest state in India by land area?', 'choices': ['Sikkim', 'Goa', 'Tripura', 'Mizoram'], 'answer': 'Goa'},
    {'question': "Which state is known as the 'Spice Garden of India'?", 'choices': ['Karnataka', 'Tamil Nadu', 'Kerala', 'Andhra Pradesh'], 'answer': 'Kerala'},
    {'question': 'Which is the highest mountain peak located entirely in India?', 'choices': ['Mount Everest', 'K2', 'Kanchenjunga', 'Nanda Devi'], 'answer': 'Kanchenjunga'},
    {'question': 'In which state is the famous desert region of Thar located?', 'choices': ['Gujarat', 'Rajasthan', 'Punjab', 'Haryana'], 'answer': 'Rajasthan'},
    {'question': "Which Indian city is known as the 'Silicon Valley of India'?", 'choices': ['Hyderabad', 'Pune', 'Chennai', 'Bengaluru'], 'answer': 'Bengaluru'},
    {'question': 'Which is the largest state in India by land area?', 'choices': ['Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Uttar Pradesh'], 'answer': 'Rajasthan'},
    {'question': "Which river is also known as the 'Dakshin Ganga'?", 'choices': ['Krishna', 'Cauvery', 'Godavari', 'Mahanadi'], 'answer': 'Godavari'},
    {'question': 'Which Indian state has the longest coastline?', 'choices': ['Maharashtra', 'Tamil Nadu', 'Gujarat', 'Andhra Pradesh'], 'answer': 'Gujarat'},
    {'question': 'Which is the largest freshwater lake in India?', 'choices': ['Chilika Lake', 'Wular Lake', 'Dal Lake', 'Vembanad Lake'], 'answer': 'Wular Lake'},
    {'question': "Which city is known as the 'City of Lakes' in Rajasthan?", 'choices': ['Jaipur', 'Jodhpur', 'Udaipur', 'Ajmer'], 'answer': 'Udaipur'},
    {'question': 'In which state is the Kaziranga National Park situated?', 'choices': ['West Bengal', 'Assam', 'Uttarakhand', 'Madhya Pradesh'], 'answer': 'Assam'},
    {'question': "Which Indian union territory is known as the 'Scenic Island Group'?", 'choices': ['Lakshadweep', 'Daman and Diu', 'Puducherry', 'Andaman and Nicobar'], 'answer': 'Andaman and Nicobar'},
    {'question': 'Which city is the financial capital of India?', 'choices': ['New Delhi', 'Mumbai', 'Kolkata', 'Bengaluru'], 'answer': 'Mumbai'},
    {'question': 'Which state has the highest literacy rate in India?', 'choices': ['Tamil Nadu', 'Kerala', 'Maharashtra', 'Himachal Pradesh'], 'answer': 'Kerala'},
    {'question': 'Which is the easternmost state of India?', 'choices': ['Assam', 'Nagaland', 'Arunachal Pradesh', 'Manipur'], 'answer': 'Arunachal Pradesh'},
    {'question': 'In which state are the famous Ajanta and Ellora caves located?', 'choices': ['Madhya Pradesh', 'Gujarat', 'Maharashtra', 'Karnataka'], 'answer': 'Maharashtra'},
    {'question': 'Which river flows through the marble rocks in Bhedaghat, Madhya Pradesh?', 'choices': ['Tapi', 'Narmada', 'Betwa', 'Chambal'], 'answer': 'Narmada'},
    {'question': 'In which city is the iconic Taj Mahal located?', 'choices': ['Delhi', 'Agra', 'Lucknow', 'Jaipur'], 'answer': 'Agra'},
    {'question': 'Where is the famous Gateway of India situated?', 'choices': ['New Delhi', 'Kolkata', 'Mumbai', 'Chennai'], 'answer': 'Mumbai'},
    {'question': 'Which monument in Delhi was built as a memorial to Indian soldiers of WWI?', 'choices': ['Red Fort', 'Qutub Minar', 'India Gate', "Humayun's Tomb"], 'answer': 'India Gate'},
    {'question': 'In which city is the Charminar located?', 'choices': ['Hyderabad', 'Bengaluru', 'Mysore', 'Kochi'], 'answer': 'Hyderabad'},
    {'question': 'Where is the famous Sun Temple of Konark located?', 'choices': ['Odisha', 'West Bengal', 'Bihar', 'Jharkhand'], 'answer': 'Odisha'},
    {'question': 'Which Mughal Emperor built the Red Fort in Delhi?', 'choices': ['Akbar', 'Jahangir', 'Shah Jahan', 'Aurangzeb'], 'answer': 'Shah Jahan'},
    {'question': 'Where is the famous Golden Temple (Harmandir Sahib) located?', 'choices': ['Amritsar', 'Ludhiana', 'Jalandhar', 'Patiala'], 'answer': 'Amritsar'},
    {'question': "Which structure in Jaipur is known as the 'Palace of Winds'?", 'choices': ['Amber Palace', 'Hawa Mahal', 'City Palace', 'Jal Mahal'], 'answer': 'Hawa Mahal'},
    {'question': 'Where is the Qutub Minar located?', 'choices': ['Agra', 'Delhi', 'Hyderabad', 'Aurangabad'], 'answer': 'Delhi'},
    {'question': 'In which state is the ancient monument Sanchi Stupa located?', 'choices': ['Uttar Pradesh', 'Bihar', 'Madhya Pradesh', 'Rajasthan'], 'answer': 'Madhya Pradesh'},
    {'question': 'Which monument is located in Mumbai harbor and carved out of solid rock?', 'choices': ['Ajanta Caves', 'Ellora Caves', 'Elephanta Caves', 'Kanheri Caves'], 'answer': 'Elephanta Caves'},
    {'question': 'Which fort in Rajasthan is famous for its massive hilltop walls?', 'choices': ['Mehrangarh Fort', 'Chittorgarh Fort', 'Jaisalmer Fort', 'Amber Fort'], 'answer': 'Chittorgarh Fort'},
    {'question': 'Where is the Victoria Memorial located?', 'choices': ['Mumbai', 'Chennai', 'Kolkata', 'Delhi'], 'answer': 'Kolkata'},
    {'question': 'The Shore Temple, a famous rock-cut monument, is in which town?', 'choices': ['Madurai', 'Thanjavur', 'Mamallapuram', 'Rameswaram'], 'answer': 'Mamallapuram'},
    {'question': 'In which city is the Gol Gumbaz, the tomb of Mohammed Adil Shah, located?', 'choices': ['Hyderabad', 'Bijapur', 'Gulbarga', 'Mysore'], 'answer': 'Bijapur'},
    {'question': 'Which city is home to the famous Bara Imambara monument?', 'choices': ['Lucknow', 'Patna', 'Delhi', 'Agra'], 'answer': 'Lucknow'},
    {'question': 'In which state is the giant Statue of Unity located?', 'choices': ['Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh'], 'answer': 'Gujarat'},
    {'question': 'Which temple in Odisha is famous for its annual Rath Yatra festival?', 'choices': ['Lingaraj Temple', 'Jagannath Temple Puri', 'Sun Temple', 'Mukteshvara Temple'], 'answer': 'Jagannath Temple Puri'},
    {'question': 'Where is the famous Brihadisvara Temple built by Rajaraja Chola I located?', 'choices': ['Madurai', 'Thanjavur', 'Kanchipuram', 'Chidambaram'], 'answer': 'Thanjavur'},
    {'question': 'In which city is the famous rock monument Jantar Mantar observatory not located?', 'choices': ['New Delhi', 'Jaipur', 'Ujjain', 'Bhopal'], 'answer': 'Bhopal'},
    {'question': "Which festival is widely known as the 'Festival of Lights'?", 'choices': ['Holi', 'Diwali', 'Dussehra', 'Makar Sankranti'], 'answer': 'Diwali'},
    {'question': 'Which festival is celebrated with vibrant colors and water splash?', 'choices': ['Diwali', 'Holi', 'Baisakhi', 'Onam'], 'answer': 'Holi'},
    {'question': 'Which harvest festival is celebrated with grand boat races in Kerala?', 'choices': ['Pongal', 'Onam', 'Bihu', 'Lohri'], 'answer': 'Onam'},
    {'question': 'Which festival celebrates the victory of Lord Rama over Ravana?', 'choices': ['Diwali', 'Dussehra', 'Raksha Bandhan', 'Janmashtami'], 'answer': 'Dussehra'},
    {'question': 'Which harvest festival is celebrated in Tamil Nadu with cooking sweet rice?', 'choices': ['Onam', 'Pongal', 'Bihu', 'Ugadi'], 'answer': 'Pongal'},
    {'question': 'Which festival celebrates the birth of Lord Krishna?', 'choices': ['Rama Navami', 'Maha Shivaratri', 'Janmashtami', 'Ganesh Chaturthi'], 'answer': 'Janmashtami'},
    {'question': 'Ganesh Chaturthi is celebrated with the grandest devotion in which Indian state?', 'choices': ['Gujarat', 'Maharashtra', 'Karnataka', 'Tamil Nadu'], 'answer': 'Maharashtra'},
    {'question': 'Which festival is celebrated by flying kites, marking the transition of the Sun?', 'choices': ['Makar Sankranti', 'Lohri', 'Baisakhi', 'Holi'], 'answer': 'Makar Sankranti'},
    {'question': 'Which festival celebrates the bond of protection between brothers and sisters?', 'choices': ['Bhai Dooj', 'Raksha Bandhan', 'Karwa Chauth', 'Teej'], 'answer': 'Raksha Bandhan'},
    {'question': 'Bihu is the traditional harvest festival of which North-Eastern state?', 'choices': ['Manipur', 'Meghalaya', 'Assam', 'Nagaland'], 'answer': 'Assam'},
    {'question': 'Which festival marks the beginning of the Sikh New Year and spring harvest?', 'choices': ['Lohri', 'Baisakhi', 'Guru Nanak Jayanti', 'Hola Mohalla'], 'answer': 'Baisakhi'},
    {'question': 'Navratri, a festival of nine nights, culminates in which major celebration?', 'choices': ['Dussehra', 'Diwali', 'Holi', 'Raksha Bandhan'], 'answer': 'Dussehra'},
    {'question': 'Which festival celebrates the goddess of learning, art, and music, Saraswati?', 'choices': ['Vasant Panchami', 'Maha Shivaratri', 'Durga Puja', 'Karwa Chauth'], 'answer': 'Vasant Panchami'},
    {'question': 'Durga Puja is the most prominent socio-cultural festival in which state?', 'choices': ['Maharashtra', 'West Bengal', 'Uttar Pradesh', 'Odisha'], 'answer': 'West Bengal'},
    {'question': 'Which state hosts the famous Hornbill Festival every December?', 'choices': ['Assam', 'Mizoram', 'Nagaland', 'Arunachal Pradesh'], 'answer': 'Nagaland'},
    {'question': 'Which annual fair in Rajasthan is world-famous for its camel trading?', 'choices': ['Pushkar Fair', 'Sonepur Fair', 'Surajkund Fair', 'Baneshwar Fair'], 'answer': 'Pushkar Fair'},
    {'question': "Ugadi is celebrated as the New Year's Day in which of these states?", 'choices': ['Kerala', 'Tamil Nadu', 'Andhra Pradesh', 'Maharashtra'], 'answer': 'Andhra Pradesh'},
    {'question': 'Which festival marks the end of the holy month of Ramadan?', 'choices': ['Eid-ul-Fitr', 'Eid-ul-Adha', 'Milad-un-Nabi', 'Muharram'], 'answer': 'Eid-ul-Fitr'},
    {'question': 'Which festival is celebrated by lighting bonfires the night before Makar Sankranti?', 'choices': ['Lohri', 'Baisakhi', 'Pongal', 'Onam'], 'answer': 'Lohri'},
    {'question': 'Which classical dance of Kerala is known for heavy makeup and masks?', 'choices': ['Kathak', 'Kathakali', 'Mohiniyattam', 'Koodiyattam'], 'answer': 'Kathakali'},
    {'question': 'Who was the first Prime Minister of independent India?', 'choices': ['Mahatma Gandhi', 'Jawaharlal Nehru', 'Subhas Chandra Bose', 'Dr. B.R. Ambedkar'], 'answer': 'Jawaharlal Nehru'},
    {'question': "Who is fondly remembered as the 'Father of the Nation' in India?", 'choices': ['Jawaharlal Nehru', 'Mahatma Gandhi', 'Sardar Patel', 'Dr. Rajendra Prasad'], 'answer': 'Mahatma Gandhi'},
    {'question': 'Who was the first female Prime Minister of India?', 'choices': ['Indira Gandhi', 'Pratibha Patil', 'Sarojini Naidu', 'Sushma Swaraj'], 'answer': 'Indira Gandhi'},
    {'question': "Which freedom fighter was popular as 'Netaji'?", 'choices': ['Bhagat Singh', 'Subhas Chandra Bose', 'Lala Lajpat Rai', 'Bal Gangadhar Tilak'], 'answer': 'Subhas Chandra Bose'},
    {'question': "Who is known as the 'Iron Man of India' for integrating princely states?", 'choices': ['Sardar Vallabhbhai Patel', 'Bhagat Singh', 'Lal Bahadur Shastri', 'B.R. Ambedkar'], 'answer': 'Sardar Vallabhbhai Patel'},
    {'question': 'Who was the chief architect of the Constitution of India?', 'choices': ['Dr. Rajendra Prasad', 'Mahatma Gandhi', 'Dr. B.R. Ambedkar', 'Jawaharlal Nehru'], 'answer': 'Dr. B.R. Ambedkar'},
    {'question': 'Which Mughal Emperor was known for his religious tolerance and building Fatehpur Sikri?', 'choices': ['Babur', 'Humayun', 'Akbar', 'Aurangzeb'], 'answer': 'Akbar'},
    {'question': 'Who was the famous Maratha king who fought against Mughal rule?', 'choices': ['Chhatrapati Shivaji Maharaj', 'Maharana Pratap', 'Prithviraj Chauhan', 'Raja Man Singh'], 'answer': 'Chhatrapati Shivaji Maharaj'},
    {'question': 'In which year did India gain independence from British rule?', 'choices': ['1942', '1945', '1947', '1950'], 'answer': '1947'},
    {'question': 'In which year did India adopt its Constitution and become a Republic?', 'choices': ['1947', '1948', '1950', '1952'], 'answer': '1950'},
    {'question': "Who wrote the national anthem of India, 'Jana Gana Mana'?", 'choices': ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Sri Aurobindo'], 'answer': 'Rabindranath Tagore'},
    {'question': "Who wrote the national song of India, 'Vande Mataram'?", 'choices': ['Rabindranath Tagore', 'Bankim Chandra Chatterjee', 'Sarojini Naidu', 'Lal Bahadur Shastri'], 'answer': 'Bankim Chandra Chatterjee'},
    {'question': 'Which ancient university in India was destroyed in the 12th century?', 'choices': ['Taxila', 'Nalanda', 'Vikramashila', 'Vallabhi'], 'answer': 'Nalanda'},
    {'question': 'Who was the ruler of Magadha who embraced Buddhism after the Kalinga War?', 'choices': ['Chandragupta Maurya', 'Samudragupta', 'Ashoka the Great', 'Harshavardhana'], 'answer': 'Ashoka the Great'},
    {'question': 'Which spiritual leader founded the Ramakrishna Mission?', 'choices': ['Swami Vivekananda', 'Ramakrishna Paramahamsa', 'Swami Dayananda', 'Raja Ram Mohan Roy'], 'answer': 'Swami Vivekananda'},
    {'question': "Who is known as the 'Nightingale of India'?", 'choices': ['Sarojini Naidu', 'Lata Mangeshkar', 'M.S. Subbulakshmi', 'Asha Bhosle'], 'answer': 'Sarojini Naidu'},
    {'question': 'Who was the first President of independent India?', 'choices': ['Dr. Rajendra Prasad', 'Dr. S. Radhakrishnan', 'Dr. Zakir Husain', 'V.V. Giri'], 'answer': 'Dr. Rajendra Prasad'},
    {'question': 'Which Sikh Guru founded the holy city of Amritsar?', 'choices': ['Guru Nanak Dev', 'Guru Ram Das', 'Guru Arjun Dev', 'Guru Gobind Singh'], 'answer': 'Guru Ram Das'},
    {'question': 'Who founded the Maurya Dynasty in ancient India?', 'choices': ['Chandragupta Maurya', 'Ashoka', 'Bindusara', 'Samudragupta'], 'answer': 'Chandragupta Maurya'},
    {'question': "Who wrote the famous Sanskrit play 'Abhijnanasakuntalam'?", 'choices': ['Kalidasa', 'Tulsidas', 'Valmiki', 'Vyasa'], 'answer': 'Kalidasa'},
    {'question': 'Which classical dance form originates from Tamil Nadu?', 'choices': ['Kathak', 'Bharatanatyam', 'Kathakali', 'Kuchipudi'], 'answer': 'Bharatanatyam'},
    {'question': 'Which classical dance form is associated with Uttar Pradesh?', 'choices': ['Kathak', 'Odissi', 'Manipuri', 'Sattriya'], 'answer': 'Kathak'},
    {'question': 'Which classical dance form originates from Andhra Pradesh?', 'choices': ['Kuchipudi', 'Kathakali', 'Bharatanatyam', 'Mohiniyattam'], 'answer': 'Kuchipudi'},
    {'question': 'What is the national animal of India?', 'choices': ['Asiatic Lion', 'Royal Bengal Tiger', 'Indian Elephant', 'Leopard'], 'answer': 'Royal Bengal Tiger'},
    {'question': 'What is the national bird of India?', 'choices': ['Indian Peacock', 'House Sparrow', 'Great Indian Bustard', 'Pigeon'], 'answer': 'Indian Peacock'},
    {'question': 'What is the national flower of India?', 'choices': ['Rose', 'Lotus', 'Marigold', 'Jasmine'], 'answer': 'Lotus'},
    {'question': 'What is the national fruit of India?', 'choices': ['Apple', 'Mango', 'Banana', 'Orange'], 'answer': 'Mango'},
    {'question': 'How many spokes are there in the Ashoka Chakra on the national flag?', 'choices': ['20', '22', '24', '26'], 'answer': '24'},
    {'question': 'What is the currency of India?', 'choices': ['Taka', 'Rupiah', 'Rupee', 'Kyat'], 'answer': 'Rupee'},
    {'question': 'Which epic was written by sage Vyasa?', 'choices': ['Ramayana', 'Mahabharata', 'Bhagavad Gita', 'Upanishad'], 'answer': 'Mahabharata'},
    {'question': 'Which is the national tree of India?', 'choices': ['Neem Tree', 'Banyan Tree', 'Peepal Tree', 'Mango Tree'], 'answer': 'Banyan Tree'},
    {'question': 'Which classical dance form belongs to the state of Odisha?', 'choices': ['Odissi', 'Manipuri', 'Kathak', 'Sattriya'], 'answer': 'Odissi'},
    {'question': 'What is the official state language of Maharashtra?', 'choices': ['Hindi', 'Marathi', 'Gujarati', 'Konkani'], 'answer': 'Marathi'},
    {'question': 'What is the official state language of Karnataka?', 'choices': ['Kannada', 'Telugu', 'Tamil', 'Malayalam'], 'answer': 'Kannada'},
    {'question': 'Which state is famous for the traditional Warli art painting?', 'choices': ['Gujarat', 'Maharashtra', 'Madhya Pradesh', 'Rajasthan'], 'answer': 'Maharashtra'},
    {'question': 'Madhubani painting is a style of folk art popular in which state?', 'choices': ['Uttar Pradesh', 'Bihar', 'West Bengal', 'Jharkhand'], 'answer': 'Bihar'},
    {'question': 'Which state is famous for the intricate Pashmina shawls?', 'choices': ['Himachal Pradesh', 'Uttarakhand', 'Jammu and Kashmir', 'Sikkim'], 'answer': 'Jammu and Kashmir'},
    {'question': 'Which is the national heritage animal of India?', 'choices': ['Tiger', 'Lion', 'Elephant', 'Rhino'], 'answer': 'Elephant'},
    {'question': "Which Indian city is known as the 'City of Nawabs'?", 'choices': ['Hyderabad', 'Lucknow', 'Bhopal', 'Patna'], 'answer': 'Lucknow'},
    {'question': 'Which state has the classical dance form called Sattriya?', 'choices': ['Assam', 'Manipur', 'Odisha', 'Kerala'], 'answer': 'Assam'},
    {'question': "Which Indian state is famous for the sweet dish 'Rasgulla'?", 'choices': ['Bihar', 'West Bengal', 'Uttar Pradesh', 'Gujarat'], 'answer': 'West Bengal'},
    {'question': "Which city is famous for the culinary delicacy 'Hyderabadi Biryani'?", 'choices': ['Mumbai', 'Lucknow', 'Hyderabad', 'Kolkata'], 'answer': 'Hyderabad'},
    {'question': "What is the primary ingredient used to make 'Dhokla'?", 'choices': ['Wheat Flour', 'Rice Flour', 'Gram Flour (Besan)', 'Maida'], 'answer': 'Gram Flour (Besan)'},
    {'question': "Which state is famous for the traditional dish 'Dal Baati Churma'?", 'choices': ['Gujarat', 'Madhya Pradesh', 'Punjab', 'Rajasthan'], 'answer': 'Rajasthan'},
    {'question': "Which city is famous for the sweet dish 'Petha'?", 'choices': ['Agra', 'Mathura', 'Varanasi', 'Lucknow'], 'answer': 'Agra'},
    {'question': 'What is the popular street food of Mumbai made of potato patty in a bun?', 'choices': ['Samosa Pav', 'Vada Pav', 'Misal Pav', 'Dabeli'], 'answer': 'Vada Pav'},
    {'question': 'Which region is famous for the Alphonso mango?', 'choices': ['Ratnagiri, Maharashtra', 'Varanasi, UP', 'Gir, Gujarat', 'Malihabad, UP'], 'answer': 'Ratnagiri, Maharashtra'},
    {'question': 'What is the name of the traditional clay oven used in North Indian cooking?', 'choices': ['Tandoor', 'Chulha', 'Angoothi', 'Sigri'], 'answer': 'Tandoor'},
    {'question': 'Which South Indian dish is a thin pancake made from fermented rice batter?', 'choices': ['Idli', 'Dosa', 'Vada', 'Uttapam'], 'answer': 'Dosa'},
    {'question': 'Which Indian state is famous for the tea gardens of Darjeeling?', 'choices': ['Assam', 'West Bengal', 'Sikkim', 'Meghalaya'], 'answer': 'West Bengal'},
    {'question': "Which city is known as the 'Tea Capital of India'?", 'choices': ['Darjeeling', 'Assam (Jorhat)', 'Munnar', 'Ooty'], 'answer': 'Assam (Jorhat)'},
    {'question': 'What is the national game of India by popular heritage?', 'choices': ['Cricket', 'Field Hockey', 'Kabaddi', 'Football'], 'answer': 'Field Hockey'},
    {'question': 'Which Indian sport involves holding breath and tagging opponents?', 'choices': ['Kho-Kho', 'Kabaddi', 'Gilli Danda', 'Mallakhamb'], 'answer': 'Kabaddi'},
    {'question': 'Which state is home to the Gir National Park, famous for Asiatic Lions?', 'choices': ['Rajasthan', 'Madhya Pradesh', 'Gujarat', 'Maharashtra'], 'answer': 'Gujarat'},
    {'question': 'Where is the headquarters of the Indian Space Research Organisation (ISRO)?', 'choices': ['Mumbai', 'New Delhi', 'Chennai', 'Bengaluru'], 'answer': 'Bengaluru'},
    {'question': 'Which monument in Hyderabad was built to celebrate the end of a plague?', 'choices': ['Golconda Fort', 'Charminar', 'Qutb Shahi Tombs', 'Mecca Masjid'], 'answer': 'Charminar'},
    {'question': 'Which state is famous for the traditional bamboo dance?', 'choices': ['Mizoram', 'Assam', 'Meghalaya', 'Manipur'], 'answer': 'Mizoram'},
    {'question': 'Which river basin is home to the Sundarbans mangrove forest?', 'choices': ['Ganga-Brahmaputra', 'Krishna-Godavari', 'Mahanadi', 'Narmada-Tapi'], 'answer': 'Ganga-Brahmaputra'},
    {'question': 'Which pass connects India with Tibet and was reopened in 2006?', 'choices': ['Nathu La Pass', 'Rohtang Pass', 'Khardung La Pass', 'Zoji La Pass'], 'answer': 'Nathu La Pass'},
    {'question': 'Which lake in Manipur is famous for its floating islands (phumdis)?', 'choices': ['Loktak Lake', 'Dal Lake', 'Chilika Lake', 'Wular Lake'], 'answer': 'Loktak Lake'},
    {'question': "Which city is known as the 'City of Nawabs'?", 'choices': ['Hyderabad', 'Lucknow', 'Patna', 'Rampur'], 'answer': 'Lucknow'},
    {'question': "Who was the author of the ancient political treatise 'Arthashastra'?", 'choices': ['Chanakya (Kautilya)', 'Kalidasa', 'Aryabhata', 'Harsha'], 'answer': 'Chanakya (Kautilya)'},
    {'question': 'Who was the great ancient Indian mathematician who introduced zero?', 'choices': ['Bhaskara', 'Aryabhata', 'Brahmagupta', 'Ramanujan'], 'answer': 'Aryabhata'},
    {'question': 'Which Indian state has the highest population?', 'choices': ['Maharashtra', 'Bihar', 'Uttar Pradesh', 'West Bengal'], 'answer': 'Uttar Pradesh'},
    {'question': "Which state is known as the 'Land of Five Rivers'?", 'choices': ['Haryana', 'Punjab', 'Uttar Pradesh', 'Himachal Pradesh'], 'answer': 'Punjab'},
    {'question': 'In which city is the Indian Military Academy located?', 'choices': ['Pune', 'Dehradun', 'New Delhi', 'Chennai'], 'answer': 'Dehradun'},
    {'question': 'Which state was previously known as the Mysore State?', 'choices': ['Kerala', 'Tamil Nadu', 'Karnataka', 'Andhra Pradesh'], 'answer': 'Karnataka'},
    {'question': 'Where is the Indian Institute of Science (IISc) located?', 'choices': ['Mumbai', 'Bengaluru', 'Kolkata', 'Chennai'], 'answer': 'Bengaluru'},
    {'question': 'Which is the national aquatic animal of India?', 'choices': ['Ganges River Dolphin', 'Blue Whale', 'Dugong', 'Olive Ridley Turtle'], 'answer': 'Ganges River Dolphin'},
    {'question': 'In which city are the famous Shalimar Gardens built by Jahangir located?', 'choices': ['Delhi', 'Srinagar', 'Lahore', 'Amritsar'], 'answer': 'Srinagar'},
    {'question': "Which state is known for the folk dance form 'Ghoomar'?", 'choices': ['Gujarat', 'Rajasthan', 'Punjab', 'Haryana'], 'answer': 'Rajasthan'},
    {'question': "Which state is known for the folk dance form 'Garba'?", 'choices': ['Maharashtra', 'Gujarat', 'Rajasthan', 'Madhya Pradesh'], 'answer': 'Gujarat'},
    {'question': "Which state is famous for the folk dance form 'Bhangra'?", 'choices': ['Haryana', 'Rajasthan', 'Punjab', 'Himachal Pradesh'], 'answer': 'Punjab'},
    {'question': "Which city is known as the 'Queen of the Arabian Sea'?", 'choices': ['Mumbai', 'Kochi', 'Mangaluru', 'Panaji'], 'answer': 'Kochi'},
    {'question': 'Which port is known as the gateway port of India?', 'choices': ['Kandla', 'Kolkata', 'Jawaharlal Nehru Port (JNPT)', 'Chennai'], 'answer': 'Jawaharlal Nehru Port (JNPT)'},
    {'question': "Which island contains India's only active volcano?", 'choices': ['Barren Island', 'Narcondam Island', 'Minicoy Island', 'Havelock Island'], 'answer': 'Barren Island'},
    {'question': "Which city in India is known as the 'City of Joy'?", 'choices': ['Mumbai', 'Delhi', 'Kolkata', 'Chennai'], 'answer': 'Kolkata'},
    {'question': 'Which sanctuary is famous for one-horned rhinoceros in India?', 'choices': ['Kaziranga Sanctuary', 'Gir Sanctuary', 'Jim Corbett Park', 'Periyar Sanctuary'], 'answer': 'Kaziranga Sanctuary'},
    {'question': 'Which is the oldest national park in India?', 'choices': ['Jim Corbett National Park', 'Kanha National Park', 'Gir National Park', 'Kaziranga National Park'], 'answer': 'Jim Corbett National Park'},
    {'question': 'Which state is the largest producer of tea in India?', 'choices': ['West Bengal', 'Assam', 'Kerala', 'Tamil Nadu'], 'answer': 'Assam'},
    {'question': 'Find the next number in the series: 2, 4, 8, 16, ?', 'choices': ['20', '24', '30', '32'], 'answer': '32'},
    {'question': 'Find the next number in the series: 3, 6, 9, 12, ?', 'choices': ['13', '14', '15', '16'], 'answer': '15'},
    {'question': 'Find the next number in the series: 1, 4, 9, 16, 25, ?', 'choices': ['30', '35', '36', '40'], 'answer': '36'},
    {'question': 'Find the next number in the series: 5, 10, 15, 20, ?', 'choices': ['21', '22', '25', '30'], 'answer': '25'},
    {'question': 'Find the next number in the series: 10, 20, 30, 40, ?', 'choices': ['45', '50', '55', '60'], 'answer': '50'},
    {'question': 'Find the next number in the series: 2, 5, 8, 11, ?', 'choices': ['12', '13', '14', '15'], 'answer': '14'},
    {'question': 'Find the next number in the series: 20, 18, 16, 14, ?', 'choices': ['10', '11', '12', '13'], 'answer': '12'},
    {'question': 'Find the next number in the series: 1, 3, 5, 7, ?', 'choices': ['8', '9', '10', '11'], 'answer': '9'},
    {'question': 'Find the next number in the series: 2, 6, 10, 14, ?', 'choices': ['16', '18', '20', '22'], 'answer': '18'},
    {'question': 'Find the next number in the series: 100, 90, 80, 70, ?', 'choices': ['50', '60', '65', '55'], 'answer': '60'},
    {'question': 'Find the next number in the series: 4, 8, 12, 16, ?', 'choices': ['18', '20', '22', '24'], 'answer': '20'},
    {'question': 'Find the next number in the series: 1, 2, 4, 8, 16, ?', 'choices': ['24', '28', '30', '32'], 'answer': '32'},
    {'question': 'Find the next number in the series: 7, 14, 21, 28, ?', 'choices': ['30', '32', '35', '42'], 'answer': '35'},
    {'question': 'Find the next number in the series: 50, 45, 40, 35, ?', 'choices': ['25', '28', '30', '32'], 'answer': '30'},
    {'question': 'Find the next number in the series: 11, 22, 33, 44, ?', 'choices': ['50', '55', '60', '66'], 'answer': '55'},
    {'question': 'Find the next number in the series: 1, 8, 27, 64, ?', 'choices': ['100', '121', '125', '150'], 'answer': '125'},
    {'question': 'Find the next number in the series: 10, 15, 25, 40, ?', 'choices': ['50', '55', '60', '65'], 'answer': '60'},
    {'question': 'Find the next number in the series: 80, 40, 20, 10, ?', 'choices': ['2', '4', '5', '8'], 'answer': '5'},
    {'question': 'Find the next number in the series: 15, 30, 45, 60, ?', 'choices': ['70', '75', '80', '90'], 'answer': '75'},
    {'question': 'Find the next number in the series: 0.5, 1, 1.5, 2, ?', 'choices': ['2.1', '2.2', '2.5', '3'], 'answer': '2.5'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Apple', 'Mango', 'Carrot', 'Banana'], 'answer': 'Carrot'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Tiger', 'Lion', 'Leopard', 'Cow'], 'answer': 'Cow'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Rose', 'Lotus', 'Spinach', 'Lily'], 'answer': 'Spinach'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Car', 'Bus', 'Train', 'Airplane'], 'answer': 'Airplane'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Cricket', 'Football', 'Hockey', 'Chess'], 'answer': 'Chess'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Triangle', 'Square', 'Rectangle', 'Sphere'], 'answer': 'Sphere'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Gold', 'Silver', 'Iron', 'Wood'], 'answer': 'Wood'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Earth', 'Mars', 'Jupiter', 'Moon'], 'answer': 'Moon'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['Pen', 'Pencil', 'Crayon', 'Notebook'], 'answer': 'Notebook'},
    {'question': 'Identify the odd one out from the options.', 'choices': ['January', 'March', 'May', 'April'], 'answer': 'April'},
    {'question': 'If CAT is coded as 3120, how is DOG coded?', 'choices': ['4157', '4167', '5157', '5167'], 'answer': '4157'},
    {'question': 'If A = 1, B = 2, C = 3, what is the value of CAB?', 'choices': ['312', '321', '123', '213'], 'answer': '312'},
    {'question': 'If RED is coded as 18-5-4, how is BLUE coded?', 'choices': ['2-12-21-5', '2-11-20-5', '3-12-21-5', '2-12-22-6'], 'answer': '2-12-21-5'},
    {'question': 'If yesterday was Monday, what day will it be tomorrow?', 'choices': ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'answer': 'Wednesday'},
    {'question': 'If tomorrow is Saturday, what day was it yesterday?', 'choices': ['Wednesday', 'Thursday', 'Friday', 'Sunday'], 'answer': 'Thursday'},
    {'question': "In a code, 'GO' is 22 and 'TO' is 35. What is the value of 'NO'?", 'choices': ['29', '30', '31', '32'], 'answer': '29'},
    {'question': 'If hot is coded as cold, what is dry coded as?', 'choices': ['Rainy', 'Wet', 'Water', 'Ice'], 'answer': 'Wet'},
    {'question': "Which word cannot be formed from the letters of 'TRANSPORT'?", 'choices': ['PORT', 'START', 'TRAP', 'RANT'], 'answer': 'START'},
    {'question': "Which word cannot be formed from the letters of 'TEACHER'?", 'choices': ['REACH', 'CHEAT', 'CHARTE', 'TEAR'], 'answer': 'CHARTE'},
    {'question': 'If Cup is to Coffee, then Bowl is to what?', 'choices': ['Water', 'Soup', 'Plate', 'Spoon'], 'answer': 'Soup'},
    {'question': 'If 5 pens cost Rs 50, how much will 8 pens cost?', 'choices': ['Rs 60', 'Rs 70', 'Rs 80', 'Rs 90'], 'answer': 'Rs 80'},
    {'question': 'A train travels at 60 km/h. How much distance does it cover in 3 hours?', 'choices': ['120 km', '150 km', '180 km', '200 km'], 'answer': '180 km'},
    {'question': 'What is the average of 10, 20, 30, 40, and 50?', 'choices': ['20', '25', '30', '35'], 'answer': '30'},
    {'question': 'A man buys a cycle for Rs 1000 and sells it for Rs 1200. What is his profit percentage?', 'choices': ['10%', '15%', '20%', '25%'], 'answer': '20%'},
    {'question': 'A student scores 45 out of 50 in an exam. What is his percentage score?', 'choices': ['80%', '85%', '90%', '95%'], 'answer': '90%'},
    {'question': 'Solve: 15 + (12 / 3) * 2 - 5', 'choices': ['10', '12', '18', '21'], 'answer': '18'},
    {'question': 'What is 20% of 150?', 'choices': ['20', '25', '30', '35'], 'answer': '30'},
    {'question': 'If a square has side length 5 cm, what is its area?', 'choices': ['10 sq cm', '20 sq cm', '25 sq cm', '30 sq cm'], 'answer': '25 sq cm'},
    {'question': 'If the perimeter of a square is 24 cm, what is the length of its side?', 'choices': ['4 cm', '5 cm', '6 cm', '8 cm'], 'answer': '6 cm'},
    {'question': 'If a rectangle has length 8 cm and width 5 cm, what is its perimeter?', 'choices': ['13 cm', '26 cm', '40 cm', '30 cm'], 'answer': '26 cm'},
    {'question': 'What is the value of 5 cubed (5^3)?', 'choices': ['25', '75', '100', '125'], 'answer': '125'},
    {'question': 'If x + 5 = 12, what is the value of x?', 'choices': ['6', '7', '8', '9'], 'answer': '7'},
    {'question': 'If 2x = 18, what is the value of x - 4?', 'choices': ['3', '4', '5', '6'], 'answer': '5'},
    {'question': 'What is the least common multiple (LCM) of 4 and 6?', 'choices': ['8', '10', '12', '24'], 'answer': '12'},
    {'question': 'What is the highest common factor (HCF) of 12 and 18?', 'choices': ['2', '3', '4', '6'], 'answer': '6'},
    {'question': 'A worker is paid Rs 300 per day. How much does he earn in 10 days?', 'choices': ['Rs 2500', 'Rs 3000', 'Rs 3500', 'Rs 4000'], 'answer': 'Rs 3000'},
    {'question': 'If a clock shows 3:00, what is the angle between the hour and minute hands?', 'choices': ['45 degrees', '90 degrees', '120 degrees', '180 degrees'], 'answer': '90 degrees'},
    {'question': 'A bag contains 3 red balls and 2 blue balls. What is the probability of drawing a red ball?', 'choices': ['1/5', '2/5', '3/5', '1/2'], 'answer': '3/5'},
    {'question': 'If the ratio of two numbers is 3:5 and their sum is 80, what is the smaller number?', 'choices': ['20', '30', '40', '50'], 'answer': '30'},
    {'question': 'What is the square root of 144?', 'choices': ['10', '11', '12', '14'], 'answer': '12'},
]

def scribbles_prompt(request):
    prompt = random.choice(PROMPTS)
    return JsonResponse(prompt)

# ----------------------------------------------------
# 3. 8-PUZZLE A* SOLVER
# ----------------------------------------------------
def get_inv_count(grid):
    inv_count = 0
    empty_value = 0
    # filter out the empty tile
    tiles = [x for x in grid if x != empty_value]
    for i in range(len(tiles)):
        for j in range(i + 1, len(tiles)):
            if tiles[i] > tiles[j]:
                inv_count += 1
    return inv_count

def is_solvable(grid):
    inv_count = get_inv_count(grid)
    # For a 3x3 grid, a state is solvable if inversion count is even
    return inv_count % 2 == 0

def get_manhattan_distance(state):
    # Goal state: 1, 2, 3, 4, 5, 6, 7, 8, 0
    # indices:    0, 1, 2, 3, 4, 5, 6, 7, 8
    # Target positions for each number 1-8
    targets = {
        1: (0, 0), 2: (0, 1), 3: (0, 2),
        4: (1, 0), 5: (1, 1), 6: (1, 2),
        7: (2, 0), 8: (2, 1), 0: (2, 2)
    }
    distance = 0
    for idx, val in enumerate(state):
        if val != 0:
            curr_r, curr_c = idx // 3, idx % 3
            targ_r, targ_c = targets[val]
            distance += abs(curr_r - targ_r) + abs(curr_c - targ_c)
    return distance

@csrf_exempt
@require_POST
def eightpuzzle_solve(request):
    try:
        data = json.loads(request.body)
        board = data.get('board') # flat array of 9 integers, 0-8
        
        # Check if solvable
        if not is_solvable(board):
            return JsonResponse({"solvable": False, "error": "This board state is unsolvable."})
            
        goal = (1, 2, 3, 4, 5, 6, 7, 8, 0)
        start = tuple(board)
        
        if start == goal:
            return JsonResponse({"solvable": True, "moves": [board]})

        # Priority queue for A*: list of tuples (f_score, g_score, state, path)
        import heapq
        
        counter = 0
        queue = []
        heapq.heappush(queue, (get_manhattan_distance(start), 0, counter, start, [list(start)]))
        
        visited = set()
        visited.add(start)
        
        max_iterations = 2500 # limit search to prevent timeout
        iterations = 0
        
        while queue and iterations < max_iterations:
            iterations += 1
            f, g, _, curr, path = heapq.heappop(queue)
            
            if curr == goal:
                return JsonResponse({"solvable": True, "moves": path})
                
            zero_idx = curr.index(0)
            r, c = zero_idx // 3, zero_idx % 3
            
            # Possible directions
            neighbors = []
            if r > 0: neighbors.append(zero_idx - 3) # Up
            if r < 2: neighbors.append(zero_idx + 3) # Down
            if c > 0: neighbors.append(zero_idx - 1) # Left
            if c < 2: neighbors.append(zero_idx + 1) # Right
            
            for next_idx in neighbors:
                new_state = list(curr)
                new_state[zero_idx], new_state[next_idx] = new_state[next_idx], new_state[zero_idx]
                new_state_tup = tuple(new_state)
                
                if new_state_tup not in visited:
                    visited.add(new_state_tup)
                    new_path = path + [new_state]
                    counter += 1
                    g_new = g + 1
                    f_new = g_new + get_manhattan_distance(new_state_tup)
                    heapq.heappush(queue, (f_new, g_new, counter, new_state_tup, new_path))
                    
        return JsonResponse({"solvable": False, "error": "Search limit reached. Puzzle too complex or unsolvable."})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

# ----------------------------------------------------
# 4. WORDLE WORD VALIDATOR
# ----------------------------------------------------
WORDLE_DICTIONARY = {
    "react", "about", "above", "actor", "acute", "admit", "adopt", "adult", "agent", "agony",
    "agree", "ahead", "alarm", "album", "alert", "alike", "alive", "allow", "alone", "along",
    "alter", "among", "anger", "angle", "angry", "apart", "apple", "apply", "arena", "argue",
    "arise", "array", "arrow", "aside", "asset", "audio", "audit", "avoid", "award", "aware",
    "badly", "baker", "bases", "basic", "basis", "beach", "beard", "beast", "begin", "being",
    "below", "bench", "berry", "bible", "birth", "black", "blade", "blame", "blind", "block",
    "blood", "board", "boast", "bonus", "boost", "bound", "brain", "brand", "bread", "break",
    "breed", "brick", "bride", "brief", "bring", "broad", "broke", "brown", "brush", "build",
    "built", "bunch", "buyer", "cable", "calmly", "camel", "camera", "camp", "canal", "candy",
    "canon", "cards", "cargo", "carry", "carve", "cases", "catch", "cater", "cause", "cease",
    "chain", "chair", "chalk", "chaos", "charm", "chart", "chase", "cheap", "cheat", "check",
    "cheek", "cheer", "chess", "chest", "chief", "child", "chime", "china", "chips", "choir",
    "chose", "chunk", "church", "cider", "cigar", "claim", "class", "clean", "clear", "clerk",
    "click", "cliff", "climb", "clock", "close", "cloth", "cloud", "clown", "coach", "coast",
    "cobra", "cocoa", "coder", "codes", "colt", "comet", "comic", "coral", "couch", "cough",
    "could", "count", "court", "cover", "craft", "crane", "crash", "crater", "crawl", "crazy",
    "cream", "creed", "creek", "creep", "crest", "crime", "crops", "cross", "crowd", "crown",
    "crude", "cruel", "crush", "crust", "crypt", "cubic", "curry", "curve", "cycle", "daily",
    "dance", "dandy", "datum", "deals", "death", "debut", "decoy", "delay", "delta", "dense",
    "depot", "depth", "devil", "diary", "digit", "dirty", "ditch", "diver", "divvy", "dizzy",
    "dodge", "dogma", "doing", "donor", "donut", "doubt", "dough", "downy", "dozen", "draft",
    "drain", "drama", "drank", "drawl", "drawn", "dread", "dream", "dress", "dried", "drift",
    "drill", "drink", "drive", "drone", "droop", "drove", "drown", "drugs", "drums", "drunk",
    "dryer", "ducky", "duvet", "dwarf", "dwell", "dying", "eager", "eagle", "early", "earth",
    "easel", "eaten", "ebony", "eclat", "edger", "edict", "edify", "eerie", "egret", "eight",
    "eject", "elbow", "elder", "elect", "elegy", "elfin", "elite", "elope", "elude", "email",
    "embed", "ember", "emery", "empty", "enact", "endow", "enema", "enemy", "enjoy", "ennui",
    "ensue", "enter", "entry", "envoy", "epoch", "epoxy", "equal", "equip", "erase", "erect",
    "error", "erupt", "essay", "ester", "ether", "ethic", "ethos", "evade", "event", "every",
    "evict", "evoke", "exact", "exalt", "excel", "exert", "exile", "exist", "exits", "expel",
    "extol", "extra", "exude", "exult", "fable", "faced", "faces", "facet", "facto", "facts",
    "faded", "fades", "fagot", "fails", "faint", "fairs", "fairy", "faith", "faker", "fakes",
    "falls", "false", "famed", "fancy", "fangs", "farce", "fared", "fares", "farms", "fasts",
    "fatal", "fated", "fates", "fatty", "fault", "fauna", "favor", "fawns", "faxes", "fears",
    "feast", "feats", "feces", "feeds", "feels", "feign", "feint", "fells", "felon", "felts",
    "femur", "fence", "fends", "feral", "ferns", "ferry", "fetal", "fetch", "fetid", "fetus",
    "feuds", "fever", "fewer", "fiber", "fibre", "fiche", "fiefs", "field", "fiend", "fiery",
    "fifes", "fifth", "fifty", "fight", "filch", "filed", "filer", "files", "filets", "fills",
    "filly", "films", "filmy", "filth", "final", "finch", "finds", "fined", "finer", "fines",
    "finis", "finks", "finny", "fiord", "fired", "fires", "firms", "first", "firth", "fishy",
    "fists", "fitly", "fiver", "fives", "fixed", "fixer", "fixes", "fizzy", "fjord", "flack",
    "flags", "flail", "flair", "flake", "flaky", "flame", "flank", "flaps", "flare", "flash",
    "flask", "flats", "flaws", "flawy", "flaxs", "flays", "fleas", "fleck", "flees", "fleet",
    "flesh", "flick", "flier", "flies", "fling", "flint", "flips", "flirt", "flits", "float",
    "flock", "flogs", "flood", "floor", "flops", "flora", "floss", "flour", "flout", "flown",
    "flows", "flubs", "flues", "fluff", "fluid", "fluke", "fluky", "flume", "flung", "flunk",
    "flush", "flute", "flyby", "flyer", "foals", "foams", "foamy", "focal", "focus", "foggy",
    "foils", "foist", "folds", "folio", "folks", "folly", "fonts", "foods", "fools", "foots",
    "foray", "force", "fords", "fores", "forge", "forgo", "forks", "forky", "forma", "forms",
    "forte", "forth", "forts", "forty", "forum", "fossa", "fosse", "fouls", "found", "fount",
    "fours", "fovea", "fowls", "foxed", "foxes", "foyer", "frags", "frail", "frame", "franc",
    "frank", "frats", "fraud", "frays", "freak", "freed", "freer", "frees", "freon", "fresh",
    "frets", "friar", "fried", "frier", "fries", "frill", "frisk", "frith", "frits", "frock",
    "frogs", "frond", "front", "frore", "frost", "froth", "frown", "froze", "fruit", "frump",
    "fryer", "fudge", "fudgy", "fuels", "fugal", "fugue", "fugus", "fully", "fumed", "fumer",
    "fumes", "funds", "fungi", "fungo", "funks", "funky", "funny", "furls", "furor", "furry",
    "furze", "fused", "fusee", "fuses", "fusil", "fussy", "fusty", "futon", "fuzzy", "gabby",
    "gable", "gaddy", "gadge", "gaffe", "gaffs", "gaged", "gager", "gages", "gaily", "gains",
    "gaits", "galah", "galas", "gales", "galls", "gally", "galop", "gamer", "games", "gamey",
    "gamic", "gamin", "gamma", "gammy", "gamps", "gamut", "ganef", "gangs", "ganja", "gated",
    "gates", "gator", "gaudy", "gauge", "giant", "globe", "glass", "glove", "ghost", "grand",
    "grass", "grave", "green", "grief", "grill", "grind", "groan", "gross", "group", "grove",
    "growl", "grown", "guard", "guess", "guest", "guide", "guild", "guilt", "habit", "hairs",
    "handy", "happy", "harsh", "haste", "hasty", "hatch", "haven", "heart", "heavy", "hello",
    "hobby", "honey", "honor", "horse", "hotel", "house", "hover", "human", "humid", "humor",
    "hurry", "ideal", "image", "imply", "index", "inner", "input", "irony", "issue", "items",
    "ivory", "jeans", "joint", "jolly", "judge", "juice", "juicy", "karma", "keepy", "keypy",
    "knife", "knock", "known", "label", "labor", "lakes", "large", "laser", "later", "laugh",
    "layer", "lead", "learn", "lease", "least", "leave", "legal", "lemon", "level", "lever",
    "light", "limit", "lined", "linen", "liner", "lines", "links", "lions", "logic", "loose",
    "lover", "lower", "loyal", "lucky", "lunar", "lunch", "lungs", "lying", "magic", "major",
    "maker", "manor", "maple", "march", "match", "maybe", "mayor", "meant", "medal", "media",
    "mercy", "merge", "merit", "metal", "micro", "midst", "might", "minor", "minus", "mirth",
    "mixer", "model", "modem", "moist", "money", "month", "moral", "motor", "mount", "mouse",
    "mouth", "moved", "mover", "moves", "movie", "music", "myths", "naive", "naked", "names",
    "nasal", "nasty", "natal", "naval", "needs", "never", "newer", "newly", "nexus", "niche",
    "night", "ninja", "ninth", "noble", "nodes", "noise", "noisy", "nomad", "north", "notch",
    "noted", "notes", "novel", "nurse", "nylon", "oasis", "occur", "ocean", "octal", "octet",
    "offer", "often", "olive", "onion", "onset", "opens", "opera", "orbit", "order", "organ",
    "other", "ought", "ounce", "outer", "owned", "owner", "oxide", "ozone", "packs", "pages",
    "pains", "paint", "pairs", "panel", "panic", "paper", "parks", "parts", "party", "pasta",
    "paste", "patch", "patio", "pause", "peace", "peach", "pearl", "pedal", "peers", "penny",
    "phase", "phone", "photo", "piano", "picks", "picky", "picot", "piece", "piles", "pilot",
    "pinch", "pinks", "pinto", "pints", "pious", "pipes", "pique", "pitch", "pivot", "pixel",
    "pixie", "pizza", "place", "plaid", "plain", "plane", "plank", "plans", "plant", "plate",
    "plays", "plaza", "plead", "pleas", "pleat", "plebe", "plebs", "plena", "plink", "plods",
    "plonk", "plops", "plots", "plows", "pluck", "plugs", "plumb", "plume", "plump", "plums",
    "plush", "pluto", "poach", "pocks", "pocky", "podgy", "podia", "poems", "poesy", "poets",
    "point", "poise", "poked", "poker", "pokes", "pokey", "polar", "poled", "poles", "polio",
    "polka", "polls", "polyp", "polys", "pomer", "pomes", "pomos", "pomps", "ponce", "ponds",
    "pones", "pongs", "pooch", "poods", "poofs", "poofy", "poohs", "pools", "poons", "poops",
    "poori", "poove", "popes", "poppa", "poppy", "popsy", "porch", "pored", "pores", "porgy",
    "porky", "porno", "porns", "porny", "ports", "posed", "poser", "poses", "posey", "posit",
    "posse", "posts", "potch", "potty", "pouch", "pouff", "poufs", "poult", "pound", "pours",
    "pouts", "pouty", "power", "poxed", "poxes", "poyou", "prams", "prang", "prank", "prate",
    "prats", "pratt", "praty", "praus", "prawn", "prays", "preed", "preen", "prees", "preps",
    "press", "prexy", "preys", "price", "prick", "pricy", "pride", "pried", "prier", "pries",
    "prigs", "prill", "prima", "prime", "primi", "primo", "primp", "prims", "prink", "print",
    "prion", "prior", "prise", "prism", "priss", "privy", "prize", "proas", "probs", "prods",
    "proem", "profs", "progs", "prole", "promo", "proms", "prone", "prong", "proof", "props",
    "prose", "proso", "pross", "prost", "prosy", "proud", "prove", "prowl", "prows", "proxy",
    "prude", "prune", "prunt", "pruta", "pryer", "psalm", "pseud", "pshaw", "psoae", "psoas",
    "psora", "psych", "pubes", "pubic", "pubis", "public", "puces", "pucka", "pucks", "pudgy",
    "pudic", "pudus", "puffs", "puffy", "puggy", "pujah", "pujas", "puked", "pukes", "pukey",
    "pulae", "pulan", "pulas", "puled", "puler", "pules", "pulik", "pilis", "pulks", "pulls",
    "pulps", "pulpy", "pulse", "pulus", "pumas", "pumie", "pumps", "punas", "punch", "pungs",
    "pungy", "punji", "punka", "punks", "punky", "punny", "punto", "punts", "punty", "pupae",
    "pupal", "pupas", "pupil", "puppy", "pupus", "purda", "purds", "puree", "purer", "pures",
    "purge", "purin", "puris", "purls", "purps", "purry", "purse", "pursy", "purty", "puses",
    "pushy", "puspy", "pussy", "puton", "putti", "putto", "putts", "putty", "pygmy", "pyins",
    "pylon", "pyoid", "pyran", "pyres", "pyrex", "pyric", "pyros", "pyxes", "pyxis", "qadis",
    "qaids", "qanat", "qophs", "quack", "quads", "quaff", "quags", "quail", "quais", "quake",
    "quaky", "quale", "qualm", "quant", "quare", "quark", "quart", "quash", "quasi", "quass",
    "quate", "quats", "quave", "quean", "queen", "queer", "quell", "queme", "quena", "quern",
    "query", "quest", "queue", "queys", "quich", "quick", "quids", "quiet", "quiff", "quill",
    "quilt", "quims", "quina", "quine", "quink", "quino", "quins", "quint", "quipo", "quips",
    "quipu", "quire", "quirk", "quirt", "quite", "quits", "quoad", "quods", "quoif", "quoin",
    "quoit", "quoll", "quonk", "quops", "quota", "quote", "quoth", "qursh", "quyte", "rabat",
    "rabbi", "rabic", "rabid", "radar", "radii", "radio", "radix", "radon", "rafts", "raged",
    "rager", "rages", "ragga", "raggs", "raggy", "ragis", "ragms", "rahed", "raher", "rahui",
    "raiah", "raias", "raids", "raika", "raiks", "raile", "rails", "rainy", "raise", "rajah",
    "rajas", "rajes", "raked", "rakee", "raker", "rakes", "rakia", "rakis", "rakus", "rales",
    "rally", "ralph", "ramal", "ramee", "ramen", "ramet", "ramie", "ramin", "ramis", "rammy",
    "ramps", "ramus", "ranas", "rance", "ranch", "rands", "randy", "ranee", "ranga", "range",
    "rangi", "rangy", "ranid", "ranis", "ranke", "ranks", "ranky", "ranqi", "rants", "ranty",
    "raped", "raper", "rapes", "raphe", "rapid", "rappe", "rared", "raree", "rarer", "rares",
    "rarks", "rased", "raser", "rases", "rasps", "raspy", "rasse", "rasta", "ratal", "ratan",
    "ratas", "ratch", "rated", "ratel", "rater", "rates", "ratha", "rathe", "raths", "ratio",
    "ratoo", "ratos", "ratty", "ratus", "raubs", "raugh", "rauns", "raupo", "raved", "ravel",
    "raven", "raver", "raves", "ravin", "rawer", "rawin", "rawly", "rawns", "raxed", "raxes",
    "rayah", "rayas", "rayed", "rayle", "rayne", "rayon", "razed", "razee", "razer", "razes",
    "razor", "reach", "react", "readd", "reads", "ready", "reaks", "realm", "realo", "reals",
    "reame", "reams", "reamy", "reaps", "rearm", "rears", "reast", "reata", "reave", "rebar",
    "rebei", "rebel", "rebid", "rebit", "reboc", "rebot", "rebuy", "rebus", "rebut", "recap",
    "recce", "recco", "reccy", "recit", "recks", "recon", "recta", "recti", "recto", "recur",
    "recut", "redan", "redds", "reddy", "reded", "redes", "redia", "redid", "redip", "redly",
    "redon", "redos", "redox", "redry", "redub", "redux", "redye", "reeds", "reedy", "reefs",
    "reefy", "reeks", "reeky", "reels", "reely", "reems", "reens", "reest", "reeve", "refed",
    "refel", "refer", "reffo", "refis", "refit", "refix", "refly", "refry", "regal", "regex",
    "round", "route", "royal", "ruled", "ruler", "rules", "rural", "sadly", "safer", "safes",
    "salad", "sales", "salon", "salsa", "salty", "sandy", "sassy", "satin", "sauce", "saucy",
    "saved", "saver", "saves", "scale", "scalp", "scaly", "scant", "scare", "scarf", "scary",
    "scene", "scent", "scope", "score", "scorn", "scout", "scowl", "scrap", "scream", "screw",
    "scrub", "scuba", "seats", "sedan", "seeds", "seedy", "seize", "semen", "sends", "sense",
    "serum", "seven", "sever", "sewer", "shade", "shady", "shaft", "shake", "shaky", "shale",
    "shall", "shame", "shampoo", "shape", "share", "shark", "sharp", "shave", "shawl", "sheaf",
    "shear", "sheds", "sheen", "sheep", "sheer", "sheet", "shelf", "shell", "shift", "shine",
    "shiny", "ships", "shirt", "shock", "shoes", "shone", "shook", "shoot", "shops", "shore",
    "short", "shote", "shots", "shout", "shove", "shown", "shows", "showy", "shred", "shrew",
    "shrub", "shrug", "shuns", "shunt", "shush", "shuts", "shyly", "sides", "siege", "sieve",
    "sight", "sigma", "signs", "silent", "silky", "silly", "since", "sinus", "sites", "sixes",
    "sixth", "sixty", "sized", "sizes", "skate", "sketch", "skier", "skies", "skill", "skims",
    "skins", "skirt", "skull", "skunk", "slate", "slave", "sleek", "sleep", "sleet", "slept",
    "slice", "slick", "slide", "slimi", "slime", "slimy", "sling", "slink", "slips", "slope",
    "slots", "slows", "slump", "slung", "slush", "smack", "small", "smart", "smash", "smear",
    "smell", "smelt", "smile", "smirk", "smite", "smith", "smoke", "smoky", "snack", "snail",
    "snake", "snaky", "snaps", "snare", "snarl", "sneak", "sneer", "sniff", "snipe", "snips",
    "snore", "snort", "snout", "snows", "snowy", "snuck", "snuff", "soapy", "sober", "socks",
    "sodas", "sofas", "softs", "softy", "soils", "solar", "soles", "solid", "solve", "sonar",
    "songs", "sonic", "sooth", "sooty", "sorry", "sorts", "souls", "sound", "soups", "soupy",
    "soury", "south", "space", "spade", "spake", "spang", "spank", "spans", "spare", "spark",
    "spars", "spasm", "spate", "spats", "spawn", "spays", "speak", "spear", "speck", "specs",
    "speed", "spell", "spelt", "spend", "spent", "sperm", "spews", "spice", "spicy", "spied",
    "spier", "spies", "spike", "spiky", "spill", "spilt", "spina", "spine", "spins", "spiny",
    "spire", "spirt", "spits", "spitz", "spivs", "split", "spoil", "spoke", "spoof", "spook",
    "spool", "spoon", "spoor", "spoot", "spore", "sport", "spots", "spout", "sprad", "sprag",
    "sprat", "spray", "spree", "sprig", "sprit", "sprod", "sprog", "spuds", "spued", "spuer",
    "spues", "spume", "spumy", "spunk", "spurn", "spurs", "spurt", "sputa", "spyal", "spyed",
    "spyre", "squab", "squad", "squat", "squaw", "squeg", "squib", "squid", "squim", "squint",
    "squiny", "squire", "squiz", "stabs", "stack", "stade", "staff", "stage", "stags", "stagy",
    "staid", "stain", "stair", "stake", "stale", "stalk", "stall", "stamp", "stand", "stane",
    "stang", "stank", "stans", "staph", "stare", "stark", "stars", "start", "stash", "state",
    "stats", "staty", "stave", "staws", "stays", "stead", "steak", "steal", "steam", "stean",
    "steed", "steek", "steel", "steem", "steep", "steer", "stein", "stela", "stele", "stems",
    "stend", "steno", "stent", "steps", "stere", "stern", "stets", "stews", "stewy", "stich",
    "stick", "stied", "sties", "stiff", "stile", "still", "stilt", "stims", "stimy", "sting",
    "stink", "stint", "stipa", "stipe", "stips", "stirk", "stirp", "stirs", "stive", "stivy",
    "stoae", "stoai", "stoas", "stoat", "stobs", "stock", "stodt", "stoep", "stoic", "stoke",
    "stole", "stoln", "stoma", "stomp", "stone", "stong", "stony", "stood", "stook", "stool",
    "stoop", "stoot", "stope", "stops", "stopt", "store", "stork", "storm", "story", "stotz",
    "stoup", "stour", "stout", "stove", "stown", "stowp", "stows", "strap", "straw", "stray",
    "strep", "strew", "stria", "strip", "strit", "strod", "strog", "stroy", "strum", "strut",
    "stubs", "stuck", "stude", "studs", "study", "stuff", "stull", "stumpi", "stump", "stumpy",
    "stums", "stung", "stunk", "stuns", "stunt", "stupa", "stupe", "sture", "sturt", "styed",
    "styes", "style", "styli", "stylo", "styme", "stymy", "styre", "styte", "suave", "subah",
    "subas", "subby", "suber", "subha", "subito", "subjee", "subjes", "subji", "subject", "subit",
    "subah", "subas", "subby", "suber", "subha", "subito", "subjee", "subjes", "subji", "subject",
    "sugar", "suite", "suits", "sulky", "sully", "sumac", "sunny", "super", "surge", "sushi",
    "swami", "swamp", "swamy", "swang", "swank", "swans", "swaps", "sward", "sware", "swarf",
    "swarm", "swart", "swash", "swath", "swats", "swayl", "sways", "swear", "sweat", "sweeds",
    "sweel", "sweep", "sweer", "sweet", "sweys", "swiad", "swies", "swift", "swigs", "swile",
    "swill", "swims", "swine", "swing", "swink", "swipe", "swire", "swirl", "swish", "swiss",
    "swith", "swits", "swive", "swivy", "swizz", "swobs", "swoop", "swoot", "swops", "sword",
    "swore", "sworn", "swots", "swoun", "swung", "sycee", "syces", "sycon", "sycos", "syrah",
    "syren", "syrup", "sysin", "syson", "tabac", "tabby", "taber", "tabes", "tabid", "tabis",
    "tabla", "table", "taboo", "tabor", "tabos", "tabun", "tabus", "taces", "tacet", "tache",
    "tacho", "tachs", "tacit", "tacks", "tacky", "tacos", "tacts", "taels", "taffy", "tafia",
    "tagge", "taggs", "taggy", "tagma", "tahas", "tahis", "tahrs", "taiga", "taigs", "taiko",
    "tails", "tains", "taint", "taira", "taise", "taish", "taits", "tajes", "takas", "taken",
    "taker", "takes", "takis", "takky", "talak", "talar", "talas", "talcs", "talcy", "talea",
    "taler", "tales", "talks", "talky", "talls", "talma", "talon", "talpa", "taluk", "talus",
    "tamal", "tamed", "tamer", "tames", "tamin", "tamis", "tammy", "tamps", "tanga", "tange",
    "tango", "tangs", "tangy", "tanie", "tanks", "tanky", "tanna", "tanny", "tansy", "tanti",
    "tants", "tanty", "tapas", "taped", "taper", "tapes", "tapet", "tapis", "tapot", "tappy",
    "tapir", "tapis", "tapsi", "tardo", "tards", "tardy", "tared", "tares", "targa", "targe",
    "targs", "tarin", "taroc", "tarok", "taros", "tarot", "tarps", "tarre", "tarry", "tarsi",
    "tarts", "tarty", "tasar", "tased", "taser", "tases", "tasks", "tassa", "tasse", "tasso",
    "taste", "tasty", "tatar", "tater", "tates", "taths", "tatie", "tatis", "tatou", "tatta",
    "tatts", "tatty", "tatus", "taube", "tauld", "taunt", "tauon", "taupe", "taura", "tauri",
    "taurs", "tauts", "taval", "tavas", "taver", "tawer", "tawes", "tawey", "tawig", "tawny",
    "tawse", "tawts", "taxed", "taxer", "taxes", "taxis", "taxol", "taxon", "taxor", "taxus",
    "tayra", "tazza", "tazze", "teach", "teade", "teads", "teady", "teals", "teams", "tears",
    "teary", "tease", "teats", "teaze", "techs", "techy", "tecta", "teddy", "teels", "teems",
    "teene", "teens", "teeny", "teers", "teeth", "teffs", "teggs", "tegua", "tehas", "tehrs",
    "teiid", "teils", "teind", "teins", "telae", "telco", "teles", "telex", "telia", "telic",
    "tells", "telly", "teloi", "telos", "temes", "tempe", "tempi", "tempo", "temps", "tempt",
    "tempy", "tench", "tends", "tendu", "tenes", "tenet", "tenga", "tengi", "tenia", "tenne",
    "tenni", "tenny", "tenon", "tenor", "tense", "tenth", "tents", "tenty", "tenue", "tenui",
    "tenus", "tepal", "tepas", "tepee", "tepid", "tepoy", "tepua", "terai", "teras", "terce",
    "terds", "tered", "teres", "terfe", "terfs", "terga", "terms", "terne", "terns", "terra",
    "terry", "terse", "terts", "tervy", "testa", "teste", "tests", "testy", "tetch", "tetra",
    "tetri", "tewed", "tewel", "tewit", "texas", "texes", "texts", "thack", "thaeo", "thali",
    "thana", "thane", "thang", "thank", "thans", "thanx", "tharm", "thars", "thash", "thata",
    "thats", "thawd", "thaws", "thawy", "thebe", "theca", "theed", "theek", "theem", "theen",
    "theep", "thees", "theft", "thegn", "theic", "thein", "their", "thela", "theme", "thems",
    "thens", "theow", "there", "therm", "these", "thesp", "theta", "thete", "thews", "thewy",
    "thick", "thief", "thigh", "thigs", "thilk", "thill", "thimi", "thine", "thing", "think",
    "thins", "thiod", "thiol", "third", "thirl", "thoft", "thoke", "thoky", "tholi", "tholl",
    "thomy", "thong", "thook", "thoon", "thore", "thorn", "thoro", "thorp", "thort", "those",
    "thoth", "thous", "thowt", "thraw", "three", "threw", "thrid", "thrip", "throb", "throe",
    "throw", "thrum", "thrun", "thuds", "thugs", "thuja", "thump", "thung", "thunk", "thurl",
    "thuya", "thyme", "thymi", "thymy", "tying", "union", "unite", "unity", "until", "upper",
    "upset", "urban", "usage", "using", "usual", "usurp", "usury", "utter", "vague", "valet",
    "valid", "value", "valve", "vapor", "vases", "vault", "vegan", "veils", "veins", "veldt",
    "venom", "vents", "venue", "venus", "verbs", "verge", "verse", "verso", "verve", "veryy",
    "vessel", "vesta", "vests", "vials", "vibes", "vicar", "video", "views", "vigil", "vigor",
    "vinyl", "viola", "viper", "viral", "virus", "visit", "visor", "vista", "vital", "vivid",
    "vocal", "vodka", "voice", "voids", "volts", "vomed", "vomer", "vomit", "voted", "voter",
    "votes", "vouch", "vowed", "vowel", "vulva", "waded", "wader", "wades", "wafer", "waged",
    "wager", "wages", "wagon", "waist", "waits", "waive", "waked", "waken", "waker", "wakes",
    "walks", "walls", "waltz", "wands", "waned", "wanes", "wants", "wards", "wares", "warms",
    "warns", "warts", "warty", "washy", "wasps", "waste", "watch", "water", "waved", "waver",
    "waves", "waxed", "waxen", "waxer", "waxes", "waxis", "weans", "wears", "weary", "weave",
    "webby", "weber", "wedge", "weeds", "weedy", "weeks", "weepy", "weeps", "weigh", "weird",
    "welch", "welds", "wells", "welsh", "welts", "wenches", "wends", "wetly", "whack", "whale",
    "whams", "wharf", "wheat", "wheel", "whelk", "whelm", "whelp", "where", "which", "whiff",
    "while", "whims", "whine", "whiny", "whips", "whipt", "whirl", "whirr", "whirs", "whish",
    "whisk", "whisp", "whist", "white", "whits", "whity", "whizz", "whole", "whoop", "whops",
    "whore", "whorl", "whort", "whose", "whoso", "whump", "widen", "wider", "widow", "width",
    "wield", "wigan", "wiggy", "wight", "wijit", "wilds", "wiled", "wiles", "wills", "willy",
    "wince", "winch", "winds", "windy", "wined", "wines", "winey", "wings", "wingy", "winks",
    "winos", "winze", "wiped", "wiper", "wipes", "wired", "wirer", "wires", "wirra", "wised",
    "wiser", "wises", "wisha", "wishy", "wisps", "wispy", "wists", "witan", "witch", "wited",
    "witen", "wites", "withe", "withy", "witty", "wived", "wiver", "wives", "wizen", "wizes",
    "woald", "woads", "woald", "woads", "woody", "woman", "women", "woods", "wordy", "world",
    "worry", "worse", "worst", "worth", "would", "wound", "woven", "wreck", "wrist", "write",
    "wrong", "wrote", "wrung", "wryly", "xenon", "yacht", "yards", "yarns", "yeast", "years",
    "yearn", "yeast", "yield", "young", "youth", "zebra", "zones", "zooms"
}

@csrf_exempt
@require_POST
def zip_generate(request):
    try:
        data = json.loads(request.body or '{}')
        grid_size = data.get('grid_size', 5)
        num_digits = data.get('num_digits', 8)
        
        grid_size = max(3, min(7, grid_size))
        num_digits = max(3, min(grid_size * grid_size - 2, num_digits))
        
        max_cells = grid_size * grid_size
        
        # Find a Hamiltonian path that covers all squares
        path = None
        for attempt in range(15):
            start_r = random.randint(0, grid_size - 1)
            start_c = random.randint(0, grid_size - 1)
            curr_path = [(start_r, start_c)]
            visited = {(start_r, start_c)}
            
            steps = [0]
            limit = 50000
            
            def dfs(r, c):
                steps[0] += 1
                if steps[0] > limit:
                    return False
                if len(curr_path) == max_cells:
                    return True
                
                dirs = [(-1,0), (1,0), (0,-1), (0,1)]
                random.shuffle(dirs)
                for dr, dc in dirs:
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < grid_size and 0 <= nc < grid_size and (nr, nc) not in visited:
                        visited.add((nr, nc))
                        curr_path.append((nr, nc))
                        if dfs(nr, nc):
                            return True
                        curr_path.pop()
                        visited.remove((nr, nc))
                return False
                
            if dfs(start_r, start_c):
                path = curr_path
                break

        digits = []
        if path:
            L = len(path)
            temp_digits = []
            temp_digits.append({"r": path[0][0], "c": path[0][1], "val": 1})
            
            for i in range(1, num_digits - 1):
                idx = int((i * (L - 1)) / (num_digits - 1))
                idx = max(1, min(L - 2, idx))
                temp_digits.append({"r": path[idx][0], "c": path[idx][1], "val": i + 1})
                
            temp_digits.append({"r": path[-1][0], "c": path[-1][1], "val": num_digits})
            
            seen = set()
            final_digits = []
            for d in temp_digits:
                coord = (d["r"], d["c"])
                if coord not in seen:
                    seen.add(coord)
                    final_digits.append(d)
            
            for index, d in enumerate(final_digits):
                d["val"] = index + 1
                
            digits = final_digits
                
        # If random walk fails, use fallback simple scatter
        if not digits:
            all_cells = [(r, c) for r in range(grid_size) for c in range(grid_size)]
            chosen = random.sample(all_cells, num_digits)
            digits = [{"r": cell[0], "c": cell[1], "val": i + 1} for i, cell in enumerate(chosen)]
            
        return JsonResponse({
            "grid_size": grid_size,
            "digits": digits
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

# ----------------------------------------------------
# 5. SUDOKU GENERATOR & BACKTRACK SOLVER
# ----------------------------------------------------
def is_valid_sudoku_move(board, row, col, num, size=9):
    for x in range(size):
        if board[row][x] == num:
            return False
            
    for x in range(size):
        if board[x][col] == num:
            return False
            
    if size == 9:
        start_row = row - row % 3
        start_col = col - col % 3
        box_r, box_c = 3, 3
    elif size == 6:
        start_row = row - row % 2
        start_col = col - col % 3
        box_r, box_c = 2, 3
    else:
        return True

    for i in range(box_r):
        for j in range(box_c):
            if board[i + start_row][j + start_col] == num:
                return False
    return True

def solve_sudoku_backtrack(board, size=9):
    for r in range(size):
        for c in range(size):
            if board[r][c] == 0:
                for num in range(1, size + 1):
                    if is_valid_sudoku_move(board, r, c, num, size):
                        board[r][c] = num
                        if solve_sudoku_backtrack(board, size):
                            return True
                        board[r][c] = 0
                return False
    return True

def fill_diagonal_sudoku_boxes(board):
    for i in range(0, 9, 3):
        fill_box(board, i, i)

def fill_box(board, row, col):
    num = 0
    for i in range(3):
        for j in range(3):
            while True:
                num = random.randint(1, 9)
                box_nums = [board[row+r][col+c] for r in range(3) for c in range(3)]
                if num not in box_nums:
                    break
            board[row+i][col+j] = num

def remove_digits_from_sudoku(board, count, size=9):
    total_cells = size * size
    while count > 0:
        cell_id = random.randint(0, total_cells - 1)
        r = cell_id // size
        c = cell_id % size
        if board[r][c] != 0:
            board[r][c] = 0
            count -= 1

@csrf_exempt
@require_POST
def sudoku_solve(request):
    try:
        data = json.loads(request.body)
        board = data.get('board')
        size = len(board)
        
        solved_board = [row[:] for row in board]
        success = solve_sudoku_backtrack(solved_board, size)
        
        return JsonResponse({"solved": success, "board": solved_board})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_POST
def sudoku_generate(request):
    try:
        data = json.loads(request.body or '{}')
        difficulty = data.get('difficulty', 'medium')
        size = data.get('size', 9)
        if size not in [6, 9]:
            size = 9
        
        board = [[0 for _ in range(size)] for _ in range(size)]
        
        if size == 9:
            fill_diagonal_sudoku_boxes(board)
            solve_sudoku_backtrack(board, size=9)
        else: # size == 6
            placed = 0
            while placed < 4:
                r = random.randint(0, 5)
                c = random.randint(0, 5)
                num = random.randint(1, 6)
                if board[r][c] == 0 and is_valid_sudoku_move(board, r, c, num, size=6):
                    board[r][c] = num
                    placed += 1
            solve_sudoku_backtrack(board, size=6)
            
        solution = [row[:] for row in board]
        
        if size == 9:
            removals = 53
            if difficulty == 'easy':
                removals = 40
            elif difficulty == 'hard':
                removals = 58
        else: # size == 6
            removals = 20
            if difficulty == 'easy':
                removals = 14
            elif difficulty == 'hard':
                removals = 24
            
        remove_digits_from_sudoku(board, removals, size)
        
        return JsonResponse({
            "board": board,
            "solution": solution
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

# ----------------------------------------------------
# 6. TYPING SPEED PASSAGES
# ----------------------------------------------------
PASSAGES = [
    {
        "text": "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet. Typing it helps warm up your fingers and builds muscle memory.",
        "author": "Classic Pangram",
        "category": "Warm-up"
    },
    {
        "text": "const calculateBestMove = (board, depth, isMaximizing) => { if (checkWinner(board)) return score; let bestVal = isMaximizing ? -Infinity : Infinity; return bestVal; };",
        "author": "Code Snippet",
        "category": "Programming"
    },
    {
        "text": "In the middle of difficulty lies opportunity. Do not stop when you are tired. Stop when you are done. Success is not final, failure is not fatal: it is the courage to continue that counts.",
        "author": "Albert Einstein & Winston Churchill",
        "category": "Inspiration"
    },
    {
        "text": "The web is more than just code. It is an interactive canvas where design meets logic, creating visual experiences that respond to the tap of a key or the drag of a mouse.",
        "author": "Design Philosophy",
        "category": "Creative"
    },
    {
        "text": "import pygame\nimport sys\npygame.init()\nscreen = pygame.display.set_mode((800, 600))\nwhile True:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            sys.exit()",
        "author": "Python Code",
        "category": "Programming"
    }
]

@require_GET
def typing_passage(request):
    passage = random.choice(PASSAGES)
    return JsonResponse(passage)


# ----------------------------------------------------
# 7. MULTIPLAYER AUTHENTICATION
# ----------------------------------------------------
@csrf_exempt
@require_POST
def auth_register(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        name = data.get('name', '').strip()

        if not email or not password or not name:
            return JsonResponse({"error": "All fields (name, email, password) are required"}, status=400)

        if User.objects.filter(email=email).exists():
            return JsonResponse({"error": "Email is already registered"}, status=400)

        # Create user (setting username = email for uniqueness lookup)
        user = User.objects.create_user(username=email, email=email, password=password, first_name=name)
        django_login(request, user)

        from django.core import signing
        token = signing.dumps({"user_id": user.id})

        return JsonResponse({
            "token": token,
            "id": user.id,
            "name": user.first_name,
            "email": user.email,
            "wins": user.profile.wins,
            "losses": user.profile.losses,
            "ties": user.profile.ties,
            "coins": user.profile.coins
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_POST
def auth_login(request):
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return JsonResponse({"error": "Email and password are required"}, status=400)

        # Authenticate using email as username
        user = authenticate(username=email, password=password)
        if user is not None:
            django_login(request, user)
            from django.core import signing
            token = signing.dumps({"user_id": user.id})
            return JsonResponse({
                "token": token,
                "id": user.id,
                "name": user.first_name,
                "email": user.email,
                "wins": user.profile.wins,
                "losses": user.profile.losses,
                "ties": user.profile.ties,
                "coins": user.profile.coins
            })
        else:
            return JsonResponse({"error": "Invalid email or password"}, status=401)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_POST
def auth_logout(request):
    django_logout(request)
    return JsonResponse({"success": True})

@require_GET
def get_profile(request):
    if request.user.is_authenticated:
        user = request.user
        return JsonResponse({
            "authenticated": True,
            "id": user.id,
            "name": user.first_name,
            "email": user.email,
            "wins": user.profile.wins,
            "losses": user.profile.losses,
            "ties": user.profile.ties,
            "coins": user.profile.coins
        })
    else:
        return JsonResponse({"authenticated": False}, status=200)

@csrf_exempt
@require_POST
def add_coins(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)
    try:
        data = json.loads(request.body)
        amount = int(data.get('amount', 0))
        if amount <= 0:
            return JsonResponse({"error": "Invalid amount"}, status=400)
        
        profile = request.user.profile
        profile.coins += amount
        profile.save()
        return JsonResponse({
            "success": True,
            "coins": profile.coins
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ----------------------------------------------------
# 8. MULTIPLAYER CHALLENGES & INVITATIONS
# ----------------------------------------------------
@csrf_exempt
@require_POST
def send_challenge(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        data = json.loads(request.body)
        receiver_email = data.get('receiver_email', '').strip().lower()
        game_type = data.get('game_type', '')

        if not receiver_email or not game_type:
            return JsonResponse({"error": "Recipient email and game type are required"}, status=400)

        receiver = User.objects.filter(email=receiver_email).first()
        if not receiver:
            return JsonResponse({"error": "No user found with this email"}, status=404)

        if receiver == request.user:
            return JsonResponse({"error": "You cannot challenge yourself!"}, status=400)

        # Check if already has a pending challenge from same sender
        existing = GameChallenge.objects.filter(
            sender=request.user, receiver=receiver, game_type=game_type, status='pending'
        ).first()
        if existing:
            return JsonResponse({"message": "Challenge already pending", "challenge_id": str(existing.challenge_id)})

        challenge = GameChallenge.objects.create(
            sender=request.user, receiver=receiver, game_type=game_type
        )
        return JsonResponse({
            "message": "Challenge sent successfully",
            "challenge_id": str(challenge.challenge_id)
        })
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@require_GET
def list_challenges(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    incoming = GameChallenge.objects.filter(receiver=request.user, status='pending')
    outgoing = GameChallenge.objects.filter(sender=request.user, status='pending')

    incoming_list = [{
        "challenge_id": str(c.challenge_id),
        "sender_name": c.sender.first_name,
        "sender_email": c.sender.email,
        "game_type": c.game_type,
        "created_at": c.created_at.isoformat()
    } for c in incoming]

    outgoing_list = [{
        "challenge_id": str(c.challenge_id),
        "receiver_name": c.receiver.first_name,
        "receiver_email": c.receiver.email,
        "game_type": c.game_type,
        "status": c.status,
        "room_id": str(c.room_id)
    } for c in outgoing]

    # Also list accepted challenges that haven't been opened yet, so user gets launched
    accepted = GameChallenge.objects.filter(sender=request.user, status='accepted')
    from django.utils import timezone
    valid_accepted = []
    for c in accepted:
        room = OnlineRoom.objects.filter(room_id=c.room_id).first()
        age_seconds = (timezone.now() - c.created_at).total_seconds()
        is_invalid_game = c.game_type not in ['tictactoe', 'rps', 'memory', 'numberguess', 'scribbles', 'nodehack', 'numberquest']
        if age_seconds > 600 or is_invalid_game or not room or room.status == 'ended':
            c.delete()
        else:
            valid_accepted.append(c)

    accepted_list = [{
        "challenge_id": str(c.challenge_id),
        "room_id": str(c.room_id),
        "game_type": c.game_type,
        "receiver_name": c.receiver.first_name
    } for c in valid_accepted]

    return JsonResponse({
        "incoming": incoming_list,
        "outgoing": outgoing_list,
        "accepted": accepted_list
    })

@csrf_exempt
@require_POST
def respond_challenge(request):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    try:
        data = json.loads(request.body)
        challenge_id = data.get('challenge_id')
        action = data.get('action') # 'accept' | 'reject'

        if not challenge_id or not action:
            return JsonResponse({"error": "Challenge ID and action are required"}, status=400)

        challenge = GameChallenge.objects.filter(challenge_id=challenge_id, receiver=request.user).first()
        if not challenge:
            return JsonResponse({"error": "Challenge not found"}, status=404)

        if action == 'accept':
            challenge.status = 'accepted'
            challenge.save()

            # Initialize the Online Game Room
            board_state = {}
            turn = challenge.sender

            if challenge.game_type == 'tictactoe':
                board_state = {"board": [""] * 9, "status": "playing"}
            elif challenge.game_type == 'rps':
                board_state = {"choices": {}, "status": "playing"}
            elif challenge.game_type == 'memory':
                emojis = ['😍', '🌀', '🥶', '🥳', '🍁', '😂', '😎', '👊']
                shuffled = emojis + emojis
                random.shuffle(shuffled)
                cards = [{"id": i, "emoji": e, "matched": False} for i, e in enumerate(shuffled)]
                board_state = {
                    "cards": cards,
                    "scores": {str(challenge.sender.id): 0, str(challenge.receiver.id): 0},
                    "selected": [],
                    "status": "playing"
                }

            elif challenge.game_type == 'numberguess':
                board_state = {
                    "target": None,
                    "max_range": 100,
                    "guesses": [],
                    "codemaker_id": challenge.sender.id,
                    "guesser_id": challenge.receiver.id,
                    "status": "setting"
                }
            elif challenge.game_type == 'scribbles':
                options = random.sample(PROMPTS, min(5, len(PROMPTS)))
                options_list = [{"word": p["word"], "hint": p["hint"], "category": p["category"]} for p in options]
                board_state = {
                    "word_options": options_list,
                    "word": "",
                    "hint": "",
                    "category": "",
                    "drawer_id": challenge.sender.id,
                    "guesser_id": challenge.receiver.id,
                    "guessed": False,
                    "status": "word_selection",
                    "time_limit": 90,
                    "start_time": None
                }

            elif challenge.game_type == 'nodehack':
                selected_q = random.sample(TRIVIA_QUESTIONS, min(5, len(TRIVIA_QUESTIONS)))
                board_state = {
                    "questions": selected_q,
                    "current_index": 0,
                    "scores": {str(challenge.sender.id): 0, str(challenge.receiver.id): 0},
                    "node_pos": 50,
                    "answered": {},
                    "status": "playing"
                }

            elif challenge.game_type == 'numberquest':
                board_state = {
                    "secret": "",
                    "guesses": [],
                    "status": "setting",
                    "codemaker_id": challenge.sender.id,
                    "guesser_id": challenge.receiver.id
                }

            room = OnlineRoom.objects.create(
                room_id=challenge.room_id,
                game_type=challenge.game_type,
                player_1=challenge.sender,
                player_2=challenge.receiver,
                turn=turn,
                board_state=json.dumps(board_state)
            )

            return JsonResponse({
                "message": "Challenge accepted",
                "room_id": str(room.room_id)
            })

        elif action == 'reject':
            challenge.status = 'rejected'
            challenge.save()
            return JsonResponse({"message": "Challenge rejected"})
            
        else:
            return JsonResponse({"error": "Invalid action"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# ----------------------------------------------------
# 9. REAL-TIME GAME ROOM SYNC
# ----------------------------------------------------
@require_GET
def get_room_state(request, room_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    room = OnlineRoom.objects.filter(room_id=room_id).first()
    if not room:
        return JsonResponse({"error": "Game room not found"}, status=404)

    # Check authorization
    if request.user != room.player_1 and request.user != room.player_2:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    # If the sender (player 1) is fetching room state, the room is active and they have entered.
    # Clean up the accepted challenge from the database so they don't auto-launch again when returning to lobby.
    if request.user == room.player_1:
        GameChallenge.objects.filter(room_id=room.room_id, sender=room.player_1, status='accepted').delete()

    return JsonResponse({
        "room_id": str(room.room_id),
        "game_type": room.game_type,
        "player_1": {
            "id": room.player_1.id,
            "name": room.player_1.first_name,
            "email": room.player_1.email
        },
        "player_2": {
            "id": room.player_2.id,
            "name": room.player_2.first_name,
            "email": room.player_2.email
        },
        "turn_id": room.turn.id if room.turn else None,
        "board_state": json.loads(room.board_state),
        "canvas_strokes": json.loads(room.canvas_strokes),
        "status": room.status,
        "winner_id": room.winner.id if room.winner else None
    })

@csrf_exempt
@require_POST
def make_room_move(request, room_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    room = OnlineRoom.objects.filter(room_id=room_id).first()
    if not room:
        return JsonResponse({"error": "Game room not found"}, status=404)

    if request.user != room.player_1 and request.user != room.player_2:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    try:
        data = json.loads(request.body)
        is_reset = data.get('is_reset', False)
        
        if is_reset:
            challenge_sender_id = room.player_1.id
            challenge_receiver_id = room.player_2.id
            
            new_board_state = {}
            room.turn = room.player_1
            room.status = 'playing'
            room.winner = None
            
            if room.game_type == 'tictactoe':
                new_board_state = {"board": [""] * 9, "status": "playing"}
            elif room.game_type == 'rps':
                new_board_state = {"choices": {}, "status": "playing"}
            elif room.game_type == 'memory':
                emojis = ['😍', '🌀', '🥶', '🥳', '🍁', '😂', '😎', '👊']
                shuffled = emojis + emojis
                random.shuffle(shuffled)
                cards = [{"id": i, "emoji": e, "matched": False} for i, e in enumerate(shuffled)]
                new_board_state = {
                    "cards": cards,
                    "scores": {str(challenge_sender_id): 0, str(challenge_receiver_id): 0},
                    "selected": [],
                    "status": "playing"
                }
            elif room.game_type == 'numberguess':
                new_board_state = {
                    "target": None,
                    "max_range": 100,
                    "guesses": [],
                    "codemaker_id": challenge_sender_id,
                    "guesser_id": challenge_receiver_id,
                    "status": "setting"
                }
            elif room.game_type == 'scribbles':
                options = random.sample(PROMPTS, min(5, len(PROMPTS)))
                options_list = [{"word": p["word"], "hint": p["hint"], "category": p["category"]} for p in options]
                new_board_state = {
                    "word_options": options_list,
                    "word": "",
                    "hint": "",
                    "category": "",
                    "drawer_id": challenge_sender_id,
                    "guesser_id": challenge_receiver_id,
                    "guessed": False,
                    "status": "word_selection",
                    "time_limit": 90,
                    "start_time": None
                }
            elif room.game_type == 'nodehack':
                selected_q = random.sample(TRIVIA_QUESTIONS, min(5, len(TRIVIA_QUESTIONS)))
                new_board_state = {
                    "questions": selected_q,
                    "current_index": 0,
                    "scores": {str(challenge_sender_id): 0, str(challenge_receiver_id): 0},
                    "node_pos": 50,
                    "answered": {},
                    "status": "playing"
                }
            elif room.game_type == 'numberquest':
                new_board_state = {
                    "secret": "",
                    "guesses": [],
                    "status": "setting",
                    "codemaker_id": challenge_sender_id,
                    "guesser_id": challenge_receiver_id
                }
                
            room.board_state = json.dumps(new_board_state)
            room.canvas_strokes = '[]'
            room.save()
            return JsonResponse({"success": True})

        board_state = data.get('board_state')
        winner_id = data.get('winner_id')
        switch_turn = data.get('switch_turn', False)
        
        if board_state:
            room.board_state = json.dumps(board_state)
            if board_state.get('status') == 'playing' and room.status == 'ended':
                room.status = 'playing'
                room.winner = None
                room.turn = room.player_1

        if switch_turn:
            room.turn = room.player_2 if room.turn == room.player_1 else room.player_1

        if winner_id is not None:
            # End the match
            room.status = 'ended'
            if winner_id == 0: # Tie
                room.winner = None
                room.player_1.profile.ties += 1
                room.player_2.profile.ties += 1
                room.player_1.profile.save()
                room.player_2.profile.save()
            else:
                winner = User.objects.filter(id=winner_id).first()
                if winner:
                    room.winner = winner
                    winner.profile.wins += 1
                    winner.profile.save()
                    
                    # Decrement stats for loser
                    loser = room.player_2 if winner == room.player_1 else room.player_1
                    loser.profile.losses += 1
                    loser.profile.save()

            # Mark challenge as complete/cleaned
            challenge = GameChallenge.objects.filter(room_id=room.room_id).first()
            if challenge:
                challenge.delete()

        room.save()
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

@csrf_exempt
@require_POST
def room_draw(request, room_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    room = OnlineRoom.objects.filter(room_id=room_id).first()
    if not room:
        return JsonResponse({"error": "Game room not found"}, status=404)

    try:
        data = json.loads(request.body)
        strokes = data.get('strokes')
        if strokes is not None:
            room.canvas_strokes = json.dumps(strokes)
            room.save()
        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@require_POST
def abandon_room(request, room_id):
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Authentication required"}, status=401)

    room = OnlineRoom.objects.filter(room_id=room_id).first()
    if not room:
        return JsonResponse({"error": "Game room not found"}, status=404)

    if request.user != room.player_1 and request.user != room.player_2:
        return JsonResponse({"error": "Unauthorized"}, status=403)

    try:
        # Load current board state
        try:
            b_state = json.loads(room.board_state)
        except:
            b_state = {}

        # Set aborted flag and status
        b_state["aborted"] = True
        b_state["aborted_by_name"] = request.user.first_name
        b_state["status"] = "ended"

        room.board_state = json.dumps(b_state)
        room.status = 'ended'
        room.save()

        # Delete matching challenge invitation
        challenge = GameChallenge.objects.filter(room_id=room.room_id).first()
        if challenge:
            challenge.delete()

        return JsonResponse({"success": True})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

