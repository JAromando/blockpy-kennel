from instructor import *
def all_for_loops():
    ast = parse_program()
    return ast.find_all("For")
#this conflics with list_repeated_in_for
def wrong_target_is_list():
    for_loops = all_for_loops()
    for loop in for_loops:
        iter_prop = loop.target
        if iter_prop.ast_name == "Name" and iter_prop.data_type == "List":
            explain('The property %s is not correctly placed in the "for" block.' % (iter_prop.id))
    return False
#this conflics with list_in_wrong_slot_in_for
def wrong_list_repeated_in_for():
    for_loops = all_for_loops()
    for loop in for_loops:
        iter_prop = loop.target
        list_prop = loop.iter
        if iter_prop.ast_name == "Name" and list_prop.ast_name == "Name" and iter_prop.id == list_prop.id and iter_prop.data_type == "List":
            explain('The %s property can only appear once in the "for" block' % (list_prop.id))
    return False
#this isn't consistent with the pattern you wrote
def missing_iterator_initialization():
    ast = parse_program()
    for_loops = all_for_loops()
    for loop in for_loops:
        list_prop = loop.iter
        if list_prop.data_type != "List" or def_use_error(list_prop):
            #compliment("Made a list initialization")
            explain("The property %s is in the list slot of the iteration but is not a list." %(list_prop.id))
            return True
    return False
#TODO: We need to cover the different cases for these
def wrong_iterator_not_list():
    for_loops = all_for_loops()
    for loop in for_loops:
        list_prop = loop.iter
        if list_prop.ast_name != "List" and list_prop.data_type != "List" and list_prop.id != "___":
            if list_prop.ast_name == "Name":
                explain("The property name(%s) has been set to something that is not a list but is placed in the iteration block that must be a list." % (list_prop.id))
                return True
    return False
def missing_target_slot_empty():
    for_loops = all_for_loops()
    for loop in for_loops:
        iter_prop = loop.target
        if iter_prop.id == "___":
            explain("You must fill in the empty slot in the iteration.")
            return True
    return False
def list_not_initialized_on_run():
    for_loops = all_for_loops()
    for loop in for_loops:
        list_prop = loop.iter
        if list_prop.data_type == None:
            explain("The list in your for loop has not been initialized")
def list_initialization_misplaced():
    for_loops = all_for_loops()
    for loop in for_loops:
        list_prop = loop.iter
        if list_prop.data_type == "List" and def_use_error(list_prop):
            explain("Initialization is a list but either wrong place or redefined")
def missing_for_slot_empty():
    for_loops = all_for_loops()
    is_missing = False
    for loop in for_loops:
        list_prop = loop.iter
        iter_prop = loop.target
        if list_prop.ast_name == "Name" and list_prop.id == "___":
            is_missing = True
            break
        if iter_prop.ast_name == "Name" and iter_prop.id == "___":
            is_missing = True
            break
    if is_missing:
        explain("You must fill in the empty slot in the iteration.")
