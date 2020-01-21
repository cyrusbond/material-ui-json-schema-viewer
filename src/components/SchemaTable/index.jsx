import React, { Fragment } from 'react';
import { shape, string, array, number, func } from 'prop-types';
import { makeStyles } from '@material-ui/core/styles';
import NormalLeftRow from '../NormalLeftRow';
import NormalRightRow from '../NormalRightRow';
import { COMBINATION_TYPES, NESTED_TYPES } from '../../utils/constants';
import {
  createSchemaTree,
  expandRefNode,
  shrinkRefNode,
} from '../../utils/schemaTree';

const useStyles = makeStyles(theme => ({
  /** Schema table displays two-column layout */
  wrapper: {
    display: 'grid',
    gridTemplateColumns: '[left-panel] 1fr [right-panel] 1fr',
    color: theme.palette.text.primary,
  },
  /** The left panel of the Schema Table */
  leftPanel: {
    backgroundColor: theme.palette.background.default,
    borderRight: `${theme.spacing(1)}px solid ${theme.palette.divider}`,
    overflowX: 'auto',
  },
  /** The right panel of the Schema Table */
  rightPanel: {
    backgroundColor: theme.palette.background.default,
    overflowX: 'auto',
  },
  /** Rows for the left and right panels */
  row: {
    borderBottom: `${theme.spacing(0.25)}px solid ${theme.palette.divider}`,
    minHeight: theme.spacing(3),
    width: '100%',
  },
  lastRow: {
    borderBottom: 'none',
  },
  /**
   * Lines within the rows.
   * (a single row may constitute of more than one line depending
   *  on how many keywords the given schema or sub-schema defines)
   */
  line: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    height: theme.spacing(3.5),
  },
  /**
   * Highlighting the type for the schema or sub-schema displayed
   * in the left panel of the schema table component.
   */
  code: {
    backgroundColor: theme.palette.grey[300],
    padding: `0 ${theme.spacing(0.5)}px`,
  },
  /** Comments within the left panel (used for combination types) */
  comment: {
    color: theme.palette.text.hint,
  },
  /**
   * Prefixes used to notate special properties of data types in
   * lines of NormalLeftRow. (ex. 'required', 'contains' keywords)
   */
  prefix: {
    color: theme.palette.error.main,
    padding: `0 ${theme.spacing(0.5)}px}`,
  },
}));

function SchemaTable({ schemaTree, setSchemaTree }) {
  /**
   * Generate classes to define overall style for the schema table.
   */
  const classes = useStyles();
  /**
   * Rows for the left and right columns are stored separately
   * so that the table can create a two-column layout with each of
   * the columns (named 'panels') having its own horizontal scroll.
   * This way, the left and right panels can render the rows separately
   * in their own containers.
   */
  const leftPanelRows = [];
  const rightPanelRows = [];

  /**
   * Create a single normal row with a left and right column each.
   * The result is stored in an object format in order for the
   * pushRow method to push the left and right row of a single row
   * into the leftPanelRows and rightPanelRows arrays respectively.
   */
  function createSingleRow(treeNode, updateTreeFunc = null) {
    console.log
    return {
      leftRow: (
        <NormalLeftRow
          key={`left-row-${leftPanelRows.length + 1}`}
          classes={classes}
          treeNode={treeNode}
          updateTreeFunc={updateTreeFunc}
        />
      ),
      rightRow: (
        <NormalRightRow
          key={`right-row-${rightPanelRows.length + 1}`}
          classes={classes}
          treeNode={treeNode}
        />
      ),
    };
  }

  /**
   * Create a literal row for displaying descriptive rows.
   * This is only used to create rows for the following:
   * - a closing row for nested types (arrays and objects) to display a
   *   close bracket symbol
   * - a separator row for combination types (allOf, anyOf, oneOf, not)
   *   to visually separate options.
   */
  function createLiteralRow(treeNode) {
    const literalSchema = {
      type: {
        array: 'closeArray',
        object: 'closeObject',
        allOf: 'and',
        anyOf: 'or',
        oneOf: 'or',
        not: 'nor',
      }[treeNode.schema.type],
    };
    const literalTreeNode = createSchemaTree(literalSchema, treeNode.path);

    return createSingleRow(literalTreeNode);
  }

  /**
   * Create a
   * Depending on the refTreeNode's 'isExpanded' state,
   * create a shrunk version of a refRow.
   *
   */
  function createRefRow(refTreeNode) {
    const { isExpanded, schema } = refTreeNode;

    /**
     * If given ref node does not have expanded state,
     * create a single row (left row & right row) where the $ref
     * is displayed in collapsed form with a button for expansion.
     * Make sure to pass a function to update the state of the schema tree.
     */
    if (!isExpanded) {
      const expandRefFunc = () => {
        setSchemaTree(expandRefNode(schemaTree, refTreeNode));
      };

      const defaultRefRow = createSingleRow(refTreeNode, expandRefFunc);
      return defaultRefRow;
    }

    /**
     * Else, given ref node has expanded state,
     * create a single row based on the fetched $ref definition.
     * Make sure to also pass a function to update the state of the
     * schema tree to use when button for shrink is clicked.
     */
    const shrinkRefFunc = () => setSchemaTree(schemaTree =>
      shrinkRefNode(schemaTree, refTreeNode)
    );

    const expandedRefRow = createSingleRow(schema.$ref, shrinkRefFunc);
    return expandedRefRow;
  }

  /**
   * Push a single row's left part and right part into
   * the leftPanelRows and rightPanelRows respectively.
   */
  function pushRow(row) {
    leftPanelRows.push(row.leftRow);
    rightPanelRows.push(row.rightRow);
  }

  /**
   * Traverse a tree or subtree in pre-order in order to create rows.
   * First, a row based on the root node will be created.
   * Then, if the root node has children, this method may be called
   * recursively to create rows for the subtree structures.
   */
  function renderNodeToRows(rootNode) {
    const schemaType = rootNode.schema.type;
    /**
     * Create a row based on the root node
     */
    const rootNodeRow =
      'isExpanded' in rootNode
        ? createRefRow(rootNode)
        : createSingleRow(rootNode);

    pushRow(rootNodeRow);

    /**
     * If the root node has children (indicating a nested structure),
     * create rows for each of the child nodes using recursion.
     */
    rootNode.children.forEach((childNode, i) => {
      /**
       * If root node's schema defines a combination type,
       * add separator rows in between the option rows
       */
      if (COMBINATION_TYPES.includes(schemaType) && i > 0) {
        const separatorRow = createLiteralRow(rootNode);

        pushRow(separatorRow);
      }

      renderNodeToRows(childNode);
    });

    /**
     * If root node's schema defines a nested types,
     * add a close row at the end to close off the nested structure
     */
    if (NESTED_TYPES.includes(schemaType)) {
      const closeRow = createLiteralRow(rootNode);

      pushRow(closeRow);
    }
  }

  /**
   * Create and render a table with two-columns based on
   * the schemaTree's overall structure.
   */
  function renderTreeToTable(schemaTreeInput) {
    /**
     * Create left and right rows each for the schema table by traversing
     * the schemaTree starting from the root node. The resulting rows will
     * be stored in leftPanelRows and rightPanelRows array each.
     * Which will then, ultimately be rendered within the leftPanal and
     * rightPanel respectively to create a two-column layout with each of
     * the columns having horizonal scrolls.
     */
    renderNodeToRows(schemaTreeInput);

    return (
      <div className={classes.wrapper}>
        <div className={classes.leftPanel}>{leftPanelRows}</div>
        <div className={classes.rightPanel}>{rightPanelRows}</div>
      </div>
    );
  }

  return <Fragment>{renderTreeToTable(schemaTree)}</Fragment>;
}

SchemaTable.propTypes = {
  /**
   * Schema tree structure defining the overall structure
   * for the schema table component.
   */
  schemaTree: shape({
    schema: shape({
      /** Type of schema */
      type: string,
    }),
    children: array,
    depth: number,
  }).isRequired,
  /**
   * Function to update schemaTree structure.
   * Used specifically for expanding or shrinking a $ref.
   */
  setSchemaTree: func.isRequired,
};

export default React.memo(SchemaTable);
